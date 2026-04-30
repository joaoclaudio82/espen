/**
 * Página "Dashboard" — KPIs + gráficos Chart.js + filtro de ações que afeta o
 * escopo da matriz exibida nos gráficos.
 *
 * As preferências do filtro vivem em `STORAGE_KEYS.dashboard` (uma entrada por
 * usuário, indexada pelo `id` do usuário) — `getDashboardSelection` resolve o
 * modo (all/none/filtered) e `saveDashboardSelection` persiste otimisticamente.
 */
import { STORAGE_KEYS, getStorage, setStorage } from '../api/storage.js';
import { getCurrentUser } from '../auth/session.js';
import { charts, setCharts } from '../core/state.js';
import { destroyDashboardCharts } from '../router.js';
import {
  countMatrizDistinctCompetenciaNames,
  isMatrizRegistroArquivado,
} from '../shared/matriz-utils.js';
import { showToast } from '../shared/toast.js';

// ── Preferências do filtro ───────────────────────────────────────────────────

function dashboardPrefMatchesUser(p, userId) {
  const u = String(userId ?? '');
  return String(p.user_id ?? '') === u || String(p.id ?? '') === u;
}

/** Resolve as preferências: ausente = todas; explicit_empty = painel vazio; filtrado = lista de ids. */
export function getDashboardSelection() {
  const currentUser = getCurrentUser();
  if (!currentUser?.id) return { mode: 'all', ids: [] };
  const prefs = getStorage(STORAGE_KEYS.dashboard) || [];
  const pref = prefs.find((p) => dashboardPrefMatchesUser(p, currentUser.id));
  if (!pref) return { mode: 'all', ids: [] };
  if (pref.explicit_empty) return { mode: 'none', ids: [] };
  const ids = Array.isArray(pref.acao_ids) ? pref.acao_ids.map(String) : [];
  // Preferências antigas: acao_ids vazio sem flag = considerar todas.
  if (ids.length === 0 && !pref.explicit_empty) return { mode: 'all', ids: [] };
  if (ids.length === 0) return { mode: 'none', ids: [] };
  return { mode: 'filtered', ids };
}

function saveDashboardSelection(actionIds, opts = {}) {
  const currentUser = getCurrentUser();
  if (!currentUser?.id) return;
  const prefs = getStorage(STORAGE_KEYS.dashboard) || [];
  const idx = prefs.findIndex((p) => dashboardPrefMatchesUser(p, currentUser.id));
  const record = {
    id: currentUser.id,
    user_id: currentUser.id,
    acao_ids: actionIds.map(String),
    explicit_empty: !!opts.explicit_empty,
  };
  if (idx >= 0) prefs[idx] = record;
  else prefs.push(record);
  setStorage(STORAGE_KEYS.dashboard, prefs);
}

// ── Escopo da matriz para os gráficos ────────────────────────────────────────

/**
 * Escopo da matriz usado nos gráficos do dashboard.
 * Se o filtro estiver em "filtrado" mas nenhuma ação tiver competências vinculadas,
 * usa fallback: todas as competências ativas (evita gráficos vazios enganosos).
 */
function getMatrizEscopoDashboard(dashSel, acoes, matriz) {
  const ativos = (matriz || []).filter((r) => !isMatrizRegistroArquivado(r));
  if (dashSel.mode === 'all') return { escopo: ativos, matrizEscopoFallback: false };
  if (dashSel.mode === 'none') return { escopo: [], matrizEscopoFallback: false };
  const idSet = new Set((dashSel.ids || []).map(String));
  const compSet = new Set();
  (acoes || []).filter((a) => idSet.has(String(a.id))).forEach((a) => {
    (a.competencias_vinculadas || []).forEach((cid) => { if (cid) compSet.add(String(cid)); });
  });
  if (compSet.size === 0) {
    if (idSet.size > 0) return { escopo: ativos, matrizEscopoFallback: true };
    return { escopo: [], matrizEscopoFallback: false };
  }
  return { escopo: ativos.filter((r) => compSet.has(String(r.id))), matrizEscopoFallback: false };
}

// ── Renderer principal ──────────────────────────────────────────────────────

export function renderDashboard() {
  destroyDashboardCharts();
  const matriz = getStorage(STORAGE_KEYS.matriz) || [];
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];
  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const users = getStorage(STORAGE_KEYS.users) || [];
  const dashSel = getDashboardSelection();
  const selIdSet = new Set((dashSel.ids || []).map(String));
  const filteredAcoes = dashSel.mode === 'none'
    ? []
    : dashSel.mode === 'filtered'
      ? acoes.filter((a) => selIdSet.has(String(a.id)))
      : acoes;
  const { escopo: matrizEscopo, matrizEscopoFallback } = getMatrizEscopoDashboard(dashSel, acoes, matriz);
  const matrizEscopoNomesDistintos = countMatrizDistinctCompetenciaNames(matrizEscopo);
  const scopeHint = dashSel.mode === 'all'
    ? 'Os gráficos refletem todas as competências ativas da matriz.'
    : dashSel.mode === 'none'
      ? 'Filtro vazio: gráficos da matriz sem dados (nenhuma ação no escopo).'
      : matrizEscopoFallback
        ? 'Ações selecionadas ainda não têm competências da matriz vinculadas; os gráficos exibem todas as competências ativas. Vincule competências em cada ação (ou use Limpar no filtro) para restringir o escopo.'
        : matrizEscopo.length
          ? 'Os gráficos mostram apenas competências vinculadas às ações selecionadas no filtro.'
          : 'Nenhuma competência da matriz vinculada às ações escolhidas. Vincule ações à matriz ou ajuste o filtro.';

  document.getElementById('page-content').innerHTML = `
    <div class="dashboard-filter-wrap">
      <div class="dashboard-filter-title">Filtro de ações no dashboard</div>
      <div class="dashboard-filter-grid">
        <div>
          <div class="dashboard-filter-quick">
            <button type="button" class="btn btn-secondary btn-sm" onclick="dashboardMarcarTodasAcoes()">Marcar todas</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="dashboardDesmarcarTodasAcoes()">Desmarcar todas</button>
          </div>
          <div class="dashboard-acoes-checkboxes" id="dashboard-acoes-checkboxes">
            ${acoes.length ? acoes.map(a => {
              const checked = dashSel.mode === 'filtered' && selIdSet.has(String(a.id));
              return `<label><input type="checkbox" name="dash-ac-filter" value="${a.id}" ${checked ? 'checked' : ''}><span>${(a.nome || 'Ação sem nome').replace(/</g, '&lt;')}${a.codigo ? ` <span style="color:var(--gray-500);">(${String(a.codigo).replace(/</g, '')})</span>` : ''}</span></label>`;
            }).join('') : '<p style="font-size:13px;color:var(--gray-500);margin:0;">Nenhuma ação cadastrada.</p>'}
          </div>
          <div class="text-muted" style="margin-top:6px;">
            ${dashSel.mode === 'all' ? 'Nenhum filtro salvo: o painel lateral lista todas as ações.' : dashSel.mode === 'none' ? 'Filtro explícito: nenhuma ação no painel (use o botão Salvar com lista vazia).' : `${filteredAcoes.length} ação(ões) no painel.`}
          </div>
          <div class="text-muted" style="margin-top:8px;font-size:12px;line-height:1.4;">${scopeHint}</div>
        </div>
        <div class="dashboard-filter-actions">
          <button class="btn btn-primary btn-sm" onclick="saveDashboardSelectionFromUI()"><i class="fas fa-filter"></i> Salvar Filtro</button>
          <button class="btn btn-secondary btn-sm" onclick="clearDashboardSelection()"><i class="fas fa-eraser"></i> Limpar</button>
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card blue">
        <div class="kpi-icon"><i class="fas fa-table-cells"></i></div>
        <div>
          <div class="kpi-number">${matrizEscopoNomesDistintos}</div>
          <div class="kpi-label">Competências no escopo — nomes distintos (${dashSel.mode === 'all' ? 'todas' : dashSel.mode === 'none' ? 'nenhuma' : 'filtrado'})</div>
        </div>
      </div>
      <div class="kpi-card gold">
        <div class="kpi-icon"><i class="fas fa-book-open"></i></div>
        <div>
          <div class="kpi-number">${filteredAcoes.length}</div>
          <div class="kpi-label">Ações em foco no Dashboard</div>
        </div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-icon"><i class="fas fa-route"></i></div>
        <div>
          <div class="kpi-number">${trilhas.length}</div>
          <div class="kpi-label">Trilhas de Aprendizagem</div>
        </div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-icon"><i class="fas fa-users"></i></div>
        <div>
          <div class="kpi-number">${users.length}</div>
          <div class="kpi-label">Usuários Cadastrados</div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title"><i class="fas fa-chart-bar" style="color:var(--navy);margin-right:8px;"></i>Competências por Eixo Funcional</div>
        <div class="chart-container"><canvas id="chart-eixo"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title"><i class="fas fa-chart-pie" style="color:var(--gold-dark);margin-right:8px;"></i>Tipologia de Complexidade</div>
        <div class="chart-container"><canvas id="chart-complexidade"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title"><i class="fas fa-chart-donut" style="color:var(--success);margin-right:8px;"></i>Categoria (Especialista vs Geral)</div>
        <div class="chart-container"><canvas id="chart-categoria"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title"><i class="fas fa-chart-bar" style="color:#7c3aed;margin-right:8px;"></i>Competências por Cargo</div>
        <div class="chart-container"><canvas id="chart-cargo"></canvas></div>
      </div>
    </div>

    <div class="charts-grid charts-grid-custom" style="grid-template-columns:2fr 1fr;">
      <div class="chart-card">
        <div class="chart-title"><i class="fas fa-chart-bar" style="color:var(--navy);margin-right:8px;"></i>Top 8 Unidades Temáticas</div>
        <div class="chart-container" style="height:280px;"><canvas id="chart-unidades"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-clock" style="color:var(--gold-dark);margin-right:8px;"></i>Ações Selecionadas</h3></div>
        <div class="card-body" style="padding:0;">
          <div id="recent-activity" style="max-height:280px;overflow-y:auto;"></div>
        </div>
      </div>
    </div>
  `;

  // Compute data for charts
  const eixoCounts = {};
  const complexCounts = { Básico: 0, Intermediário: 0, Avançado: 0 };
  const catCounts = { Especialista: 0, Geral: 0 };
  const cargoCounts = {};
  const unidadeCounts = {};

  matrizEscopo.forEach((r) => {
    const e = r.eixo || 'Outros';
    const ek = e.length > 30 ? e.substring(0, 28) + '…' : e;
    eixoCounts[ek] = (eixoCounts[ek] || 0) + 1;
    const tcx = r.tipologia_complexidade;
    if (tcx) complexCounts[tcx] = (complexCounts[tcx] || 0) + 1;
    if (r.categoria) catCounts[r.categoria] = (catCounts[r.categoria] || 0) + 1;
    if (r.cargo) cargoCounts[r.cargo] = (cargoCounts[r.cargo] || 0) + 1;
    if (r.unidade) unidadeCounts[r.unidade] = (unidadeCounts[r.unidade] || 0) + 1;
  });

  let topUnidades = Object.entries(unidadeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!Object.keys(eixoCounts).length) eixoCounts['(sem dados no escopo)'] = 0;
  if (!Object.keys(cargoCounts).length) cargoCounts['(sem dados no escopo)'] = 0;
  if (!topUnidades.length) topUnidades = [['(sem dados no escopo)', 0]];

  setTimeout(() => {
    const Chart = window.Chart;
    if (!Chart) return;

    // Chart: Eixo Funcional
    const ctxEixo = document.getElementById('chart-eixo');
    if (ctxEixo) {
      charts.eixo = new Chart(ctxEixo, {
        type: 'bar',
        data: {
          labels: Object.keys(eixoCounts),
          datasets: [{ label: 'Competências', data: Object.values(eixoCounts), backgroundColor: '#1a237e', borderRadius: 5 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 } } } } },
      });
    }

    // Chart: Complexidade (valores além de Básico/Intermediário/Avançado recebem cores cíclicas)
    const ctxComp = document.getElementById('chart-complexidade');
    if (ctxComp) {
      const compKeys = Object.keys(complexCounts);
      const compPalette = ['#28a745', '#ffc107', '#1a237e', '#6c757d', '#17a2b8', '#6610f2', '#e83e8c', '#20c997'];
      charts.complexidade = new Chart(ctxComp, {
        type: 'pie',
        data: {
          labels: compKeys,
          datasets: [{
            data: Object.values(complexCounts),
            backgroundColor: compKeys.map((_, i) => compPalette[i % compPalette.length]),
            borderWidth: 2,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    }

    // Chart: Categoria
    const ctxCat = document.getElementById('chart-categoria');
    if (ctxCat) {
      charts.categoria = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: Object.keys(catCounts),
          datasets: [{ data: Object.values(catCounts), backgroundColor: ['#1a237e', '#ffc107'], borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
      });
    }

    // Chart: Cargo
    const ctxCargo = document.getElementById('chart-cargo');
    if (ctxCargo) {
      const cargoKeys = Object.keys(cargoCounts);
      const cargoLabels = cargoKeys.map((c) => (c.length > 36 ? `${c.substring(0, 34)}…` : c));
      charts.cargo = new Chart(ctxCargo, {
        type: 'bar',
        data: {
          labels: cargoLabels,
          datasets: [{ label: 'Competências', data: Object.values(cargoCounts), backgroundColor: ['#7c3aed', '#059669', '#d97706'], borderRadius: 5 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 } } } } },
      });
    }

    // Chart: Unidades Temáticas
    const ctxUni = document.getElementById('chart-unidades');
    if (ctxUni) {
      charts.unidades = new Chart(ctxUni, {
        type: 'bar',
        data: {
          labels: topUnidades.map(([k]) => k.length > 25 ? k.substring(0, 23) + '…' : k),
          datasets: [{ label: 'Competências', data: topUnidades.map(([, v]) => v), backgroundColor: '#283593', borderRadius: 5 }],
        },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 } } } } },
      });
    }

    // Ações em foco no dashboard
    const activityEl = document.getElementById('recent-activity');
    if (activityEl) {
      if (!filteredAcoes.length) {
        const emptyTitle = dashSel.mode === 'none' ? 'Escopo vazio' : !acoes.length ? 'Nenhuma ação cadastrada' : 'Nenhuma ação no painel';
        const emptyBody =
          dashSel.mode === 'none'
            ? 'Foi salvo um filtro sem nenhuma ação: marque as desejadas e salve de novo, ou use Limpar para voltar ao panorama completo da matriz.'
            : !acoes.length
              ? 'Cadastre ações educativas para poder filtrá-las aqui.'
              : 'Marque uma ou mais ações no filtro acima e clique em Salvar Filtro.';
        activityEl.innerHTML = `
          <div class="empty-state" style="padding:26px 20px;">
            <i class="fas fa-book-open"></i>
            <h3>${emptyTitle}</h3>
            <p>${emptyBody}</p>
          </div>
        `;
        return;
      }
      activityEl.innerHTML = filteredAcoes.slice(0, 12).map((a) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--gray-100);">
          <div style="width:34px;height:34px;border-radius:8px;background:rgba(26,35,126,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="fas fa-book-open" style="font-size:14px;color:var(--navy);"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:600;color:var(--gray-800);">${a.nome || 'Ação sem nome'}</div>
            <div style="font-size:11px;color:var(--gray-500);">
              ${a.codigo || 'Sem código'} • ${a.modalidade || 'Modalidade não informada'} • ${a.carga_horaria || 0}h
            </div>
          </div>
        </div>
      `).join('');
    }
  }, 100);
}

// ── Handlers acoplados ao DOM (clicados via inline handlers) ─────────────────

function saveDashboardSelectionFromUI() {
  const selectedIds = Array.from(document.querySelectorAll('input[name="dash-ac-filter"]:checked')).map((cb) => cb.value);
  saveDashboardSelection(selectedIds, { explicit_empty: selectedIds.length === 0 });
  const msg = selectedIds.length === 0
    ? 'Filtro salvo: nenhuma ação no escopo; gráficos da matriz ficam vazios até você escolher ações ou limpar o filtro.'
    : `Filtro salvo com ${selectedIds.length} ação(ões). Gráficos da matriz usam só competências vinculadas a essas ações.`;
  showToast(msg, 'success');
  renderDashboard();
}

function clearDashboardSelection() {
  const currentUser = getCurrentUser();
  if (!currentUser?.id) return;
  const prefs = (getStorage(STORAGE_KEYS.dashboard) || []).filter((p) => !dashboardPrefMatchesUser(p, currentUser.id));
  setStorage(STORAGE_KEYS.dashboard, prefs);
  showToast('Filtro do dashboard resetado: todas as ações no painel.', 'info');
  renderDashboard();
}

function dashboardMarcarTodasAcoes() {
  document.querySelectorAll('input[name="dash-ac-filter"]').forEach((cb) => { cb.checked = true; });
}

function dashboardDesmarcarTodasAcoes() {
  document.querySelectorAll('input[name="dash-ac-filter"]').forEach((cb) => { cb.checked = false; });
}

Object.assign(globalThis, {
  renderDashboard,
  saveDashboardSelectionFromUI,
  clearDashboardSelection,
  dashboardMarcarTodasAcoes,
  dashboardDesmarcarTodasAcoes,
});
