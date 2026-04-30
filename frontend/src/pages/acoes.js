/**
 * Página "Ações Educativas" — listagem em cards/tabela com filtros e paginação,
 * formulário modal extenso (cadastro único da ESPEN), detalhe completo,
 * exclusão. Edições não-admin via fila de moderação.
 */
import { STORAGE_KEYS, getStorage, setStorage } from '../api/storage.js';
import { isAdminUser, isSomenteLeitura, usaFilaModeracao } from '../auth/roles.js';
import {
  acoesFilter,
  acoesPage,
  acoesPerPage,
  acoesViewMode,
  setAcoesPage,
  setAcoesViewMode,
} from '../core/state.js';
import { closeModalBtn, openModal } from '../router.js';
import { acaoEixoUnidadeFromLegacy, syncEixoTematicoLegado } from '../shared/acoes-utils.js';
import { escapeHtmlStr } from '../shared/escape.js';
import { fmtAE, genId, idEquals, normalizeActionCode } from '../shared/format.js';
import { isMatrizRegistroArquivado } from '../shared/matriz-utils.js';
import { pushFilaModeracao } from '../shared/moderacao.js';
import { getPaginationButtons } from '../shared/pagination.js';
import { showToast } from '../shared/toast.js';

// ── Sugestão por similaridade com a matriz (campo "Magic" no formulário) ─────

function tokenizarTexto(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9áéíóúâêôãõç]+/i)
    .filter((w) => w.length > 2);
}

function similaridadeJaccardTokens(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const u = A.size + B.size - inter;
  return u ? inter / u : 0;
}

function sugerirCamposAcaoPorMatriz() {
  const nomeEl = document.getElementById('af-nome');
  const objEl = document.getElementById('af-objetivo');
  if (!nomeEl || !objEl) return;
  const q = [...tokenizarTexto(nomeEl.value), ...tokenizarTexto(objEl.value)];
  if (q.length < 2) {
    showToast('Informe nome e/ou objetivo da ação para buscar similaridade na matriz.', 'warning');
    return;
  }
  const matriz = (getStorage(STORAGE_KEYS.matriz) || []).filter((m) => !isMatrizRegistroArquivado(m));
  let best = null;
  let bestScore = 0;
  matriz.forEach((m) => {
    const pool = [...tokenizarTexto(m.competencia), ...tokenizarTexto(m.objetivo), ...tokenizarTexto(m.conhecimento), ...tokenizarTexto(m.unidade)];
    const s = similaridadeJaccardTokens(q, pool);
    if (s > bestScore) { bestScore = s; best = m; }
  });
  if (!best || bestScore < 0.03) {
    showToast('Nenhuma competência com similaridade suficiente. Ajuste o nome ou o objetivo.', 'warning');
    return;
  }
  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id);
    if (!el || !val) return;
    if (!String(el.value || '').trim()) {
      el.value = val;
      el.classList.add('field-sugerido');
    }
  };
  setIfEmpty('af-eixo', best.eixo || '');
  setIfEmpty('af-unidade', best.unidade || '');
  setIfEmpty('af-competencia-mcn', best.competencia || '');
  setIfEmpty('af-eixo-func-mcn', best.eixo || '');
  setIfEmpty('af-unidade-mcn', best.unidade || '');
  setIfEmpty('af-conhecimento-mcn', best.conhecimento || '');
  setIfEmpty('af-obj-aprend-mcn', best.objetivo || '');
  setIfEmpty('af-competencia-texto', best.competencia || '');
  setIfEmpty('af-ementa', best.objetivo ? `Com base na competência: ${best.competencia}\n\n${best.objetivo}`.slice(0, 4000) : '');
  setIfEmpty('af-metodologia', 'Estudo de caso, reflexão guiada e práticas alinhadas às diretrizes da MCN.');
  setIfEmpty('af-conteudo', best.conhecimento ? `Eixo: ${best.eixo || '—'}\nUnidade temática: ${best.unidade || '—'}\nConhecimento crítico: ${best.conhecimento}` : '');
  document.querySelectorAll('input[name="af-comp-vinc"]').forEach((cb) => { cb.checked = cb.value === best.id; });
  showToast(`Sugestão aplicada a partir da competência (${(bestScore * 100).toFixed(0)}% similaridade). Revise os campos destacados.`, 'success');
}

// ── Render principal + filtros ───────────────────────────────────────────────

export function renderAcoes() {
  const podeAlterar = !isSomenteLeitura();
  document.getElementById('topbar-actions').innerHTML = `
    ${podeAlterar ? `<button class="btn btn-gold btn-sm" onclick="openAcaoForm()"><i class="fas fa-plus"></i> <span class="btn-label">Nova Ação</span></button>` : ''}
    ${isAdminUser() ? `<button class="btn btn-secondary btn-sm" onclick="importExcelData(STORAGE_KEYS.acoes)" title="Importar Excel"><i class="fas fa-file-import"></i> <span class="btn-label">Importar Excel</span></button>` : ''}
    <button class="btn btn-secondary btn-sm" onclick="exportAcoesDOCX(this)" title="Exportar DOCX (Word)" style="color:#2b579a;">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
  `;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Ações Educativas</div>
        <div class="section-sub">Cadastro Único das Ações Educativas da ESPEN/SENAPPEN</div>
      </div>
    </div>
    <div class="filters-bar">
      <div class="search-box" style="flex:2;">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Buscar ações educativas..." oninput="acoesFilter.search=this.value;acoesPage=1;renderAcoesGrid()">
      </div>
      <div class="filter-group">
        <label>Modalidade</label>
        <select onchange="acoesFilter.modalidade=this.value;acoesPage=1;renderAcoesGrid()">
          <option value="">Todas</option>
          <option>EaD</option><option>Presencial</option><option>Semipresencial</option><option>Híbrido</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Status</label>
        <select onchange="acoesFilter.status=this.value;acoesPage=1;renderAcoesGrid()">
          <option value="">Todos</option>
          <option>Ativo</option><option>Inativo</option><option>Em elaboração</option>
        </select>
      </div>
      <div class="filter-group" style="min-width:220px;">
        <label>Competência (matriz)</label>
        <select id="ac-filter-comp" onchange="acoesFilter.competenciaMatrizId=this.value;acoesPage=1;renderAcoesGrid()">
          <option value="">Todas</option>
          ${(getStorage(STORAGE_KEYS.matriz)||[]).filter((m) => !isMatrizRegistroArquivado(m)).map((m) => `<option value="${m.id}">${(m.competencia||'').substring(0,70)}${(m.competencia||'').length>70?'…':''}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="toggleAcoesView()" title="Alternar visualização" style="min-width:150px;">
        <i class="fas ${acoesViewMode === 'cards' ? 'fa-table' : 'fa-table-cells-large'}"></i>
        <span class="btn-label">${acoesViewMode === 'cards' ? 'Modo tabela' : 'Modo cards'}</span>
      </button>
      <button class="btn btn-secondary btn-sm" onclick="acoesFilter={search:'',modalidade:'',status:'',competenciaMatrizId:''};acoesPage=1;var el=document.getElementById('ac-filter-comp');if(el)el.value='';renderAcoes()"><i class="fas fa-times"></i> Limpar</button>
    </div>
    <div id="acoes-grid"></div>
  `;
  renderAcoesGrid();
}

export function toggleAcoesView() {
  setAcoesViewMode(acoesViewMode === 'cards' ? 'table' : 'cards');
  setAcoesPage(1);
  renderAcoes();
}

function getAcoesFilteredData() {
  let data = getStorage(STORAGE_KEYS.acoes) || [];
  if (acoesFilter.search) {
    const s = acoesFilter.search.toLowerCase();
    data = data.filter((a) => [a.nome, a.codigo, a.eixo_tematico, a.eixo, a.unidade, a.justificativa_oferta, a.publico_alvo]
      .some((x) => (x || '').toLowerCase().includes(s)));
  }
  if (acoesFilter.modalidade) data = data.filter((a) => a.modalidade === acoesFilter.modalidade);
  if (acoesFilter.status) data = data.filter((a) => a.status === acoesFilter.status);
  if (acoesFilter.competenciaMatrizId) {
    const cid = acoesFilter.competenciaMatrizId;
    data = data.filter((a) => (a.competencias_vinculadas || []).includes(cid));
  }
  return data;
}

export function renderAcoesGrid() {
  const grid = document.getElementById('acoes-grid');
  if (!grid) return;
  const data = getAcoesFilteredData();

  const podeAlterar = !isSomenteLeitura();
  const mColors = { 'EaD': 'blue', 'Presencial': 'green', 'Semipresencial': 'orange', 'Híbrido': 'gold' };
  const sColors = { 'Ativo': 'green', 'Inativo': 'red', 'Em elaboração': 'gold' };

  if (data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><h3>Nenhuma ação encontrada</h3><p>Adicione ações educativas para visualizar aqui</p>${!isSomenteLeitura() ? '<button class="btn btn-primary" onclick="openAcaoForm()"><i class="fas fa-plus"></i> Nova Ação</button>' : ''}</div>`;
    return;
  }

  if (acoesViewMode === 'table') {
    const total = data.length;
    const totalPages = Math.ceil(total / acoesPerPage);
    if (acoesPage > totalPages && totalPages > 0) setAcoesPage(totalPages);
    const start = (acoesPage - 1) * acoesPerPage;
    const page = data.slice(start, start + acoesPerPage);

    grid.innerHTML = `
      <div class="table-card">
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th style="min-width:110px;">Código</th>
                <th style="min-width:280px;">Ação educativa</th>
                <th>Modalidade</th>
                <th>Status</th>
                <th>Carga horária</th>
                <th>Público-alvo</th>
                ${podeAlterar ? '<th style="width:120px;">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${page.map((a) => `
                <tr onclick="viewAcaoDetail('${a.id}')" style="cursor:pointer;">
                  <td><span class="badge badge-purple">${a.codigo||'—'}</span></td>
                  <td><strong>${a.nome||'—'}</strong></td>
                  <td><span class="badge badge-${mColors[a.modalidade]||'gray'}">${a.modalidade||'—'}</span></td>
                  <td><span class="badge badge-${sColors[a.status]||'gray'}">${a.status||'—'}</span></td>
                  <td>${a.carga_horaria||0}h</td>
                  <td>${a.publico_alvo||'—'}</td>
                  ${podeAlterar ? `<td onclick="event.stopPropagation()">
                    <button class="btn btn-secondary btn-sm" onclick="editAcao('${a.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAcao('${a.id}')"><i class="fas fa-trash"></i></button>
                  </td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <div class="page-info">Exibindo ${start + 1}–${Math.min(start + acoesPerPage, total)} de <strong>${total}</strong> registros</div>
          <div class="pagination">
            <button class="page-btn" onclick="acoesPage=Math.max(1,acoesPage-1);renderAcoesGrid()" ${acoesPage<=1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
            ${getPaginationButtons(acoesPage, totalPages, 'acoesPage', 'renderAcoesGrid()')}
            <button class="page-btn" onclick="acoesPage=Math.min(${totalPages},acoesPage+1);renderAcoesGrid()" ${acoesPage>=totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;">` +
    data.map((a) => `
      <div class="action-card" onclick="viewAcaoDetail('${a.id}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <span class="badge badge-purple" style="margin-bottom:6px;">${a.codigo||'—'}</span>
            <h3 style="font-size:14px;font-weight:700;color:var(--gray-900);line-height:1.4;">${a.nome||'—'}</h3>
          </div>
          ${podeAlterar ? `<div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;" onclick="event.stopPropagation()">
            <button class="btn btn-secondary btn-sm" onclick="editAcao('${a.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteAcao('${a.id}')"><i class="fas fa-trash"></i></button>
          </div>` : ''}
        </div>
        <div style="font-size:12px;color:var(--gray-600);margin-bottom:12px;line-height:1.5;">${(a.objetivo_geral||'').substring(0,120)}${a.objetivo_geral&&a.objetivo_geral.length>120?'…':''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span class="badge badge-${mColors[a.modalidade]||'gray'}">${a.modalidade||'—'}</span>
          <span class="badge badge-${sColors[a.status]||'gray'}">${a.status||'—'}</span>
          <span class="badge badge-gray"><i class="fas fa-clock" style="margin-right:4px;"></i>${a.carga_horaria||0}h</span>
          <span class="badge badge-gray"><i class="fas fa-layer-group" style="margin-right:4px;"></i>${a.num_modulos||1} módulo${(a.num_modulos||1)>1?'s':''}</span>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--gray-500);">
          <i class="fas fa-users" style="margin-right:4px;"></i>${a.publico_alvo||'—'}
        </div>
      </div>
    `).join('') + `</div>`;
}

// ── Detalhe (modal) ──────────────────────────────────────────────────────────

export function viewAcaoDetail(id) {
  const data = getStorage(STORAGE_KEYS.acoes) || [];
  const a = data.find((x) => idEquals(x.id, id));
  if (!a) return;
  const eu = acaoEixoUnidadeFromLegacy(a);
  const instAp = a.instrumento_avaliacao_aprendizagem || a.instrumento_avaliacao || '';
  const mColors = { 'EaD': 'blue', 'Presencial': 'green', 'Semipresencial': 'orange', 'Híbrido': 'gold' };
  const sColors = { 'Ativo': 'green', 'Inativo': 'red', 'Em elaboração': 'gold' };
  const body = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
      <span class="badge badge-purple">${fmtAE(a.codigo)}</span>
      <span class="badge badge-${mColors[a.modalidade]||'gray'}">${fmtAE(a.modalidade)}</span>
      <span class="badge badge-${sColors[a.status]||'gray'}">${fmtAE(a.status)}</span>
      <span class="badge badge-gray">${a.carga_horaria||0}h</span>
    </div>
    <div class="form-section-title">Contexto (cadastro único)</div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Estado</div><div class="detail-value">${fmtAE(a.estado)}</div></div>
      <div class="detail-field"><div class="detail-label">Sigla Estado</div><div class="detail-value">${fmtAE(a.sigla_estado)}</div></div>
      <div class="detail-field"><div class="detail-label">É Trilha?</div><div class="detail-value">${fmtAE(a.e_trilha)}</div></div>
      <div class="detail-field"><div class="detail-label">É Módulo?</div><div class="detail-value">${fmtAE(a.e_modulo)}</div></div>
    </div>
    <div class="detail-field"><div class="detail-label">Módulos associados</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.modulos_associados)}</div></div>
    <div class="divider"></div>
    <div class="form-section-title">Alinhamento MCN (texto)</div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Competência MCN</div><div class="detail-value">${fmtAE(a.competencia_mcn)}</div></div>
      <div class="detail-field"><div class="detail-label">Eixo funcional MCN</div><div class="detail-value">${fmtAE(a.eixo_funcional_mcn)}</div></div>
      <div class="detail-field"><div class="detail-label">Unidade temática MCN</div><div class="detail-value">${fmtAE(a.unidade_tematica_mcn)}</div></div>
    </div>
    <div class="detail-field"><div class="detail-label">Conhecimento crítico e para a prática</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.conhecimento_critico_mcn)}</div></div>
    <div class="detail-field"><div class="detail-label">Objetivo de aprendizagem MCN</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.objetivo_aprendizagem_mcn)}</div></div>
    <div class="divider"></div>
    <div class="form-section-title">Identificação</div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Código / ID AE</div><div class="detail-value">${fmtAE(a.codigo)}</div></div>
      <div class="detail-field"><div class="detail-label">Tipo</div><div class="detail-value">${fmtAE(a.tipo)}</div></div>
      <div class="detail-field"><div class="detail-label">Área Demandante</div><div class="detail-value">${fmtAE(a.area_demandante)}</div></div>
      <div class="detail-field"><div class="detail-label">Escola Proponente</div><div class="detail-value">${fmtAE(a.escola_proponente)}</div></div>
      <div class="detail-field"><div class="detail-label">Eixo (oferta)</div><div class="detail-value">${fmtAE(eu.eixo || a.eixo_tematico)}</div></div>
      <div class="detail-field"><div class="detail-label">Unidade (oferta)</div><div class="detail-value">${fmtAE(eu.unidade)}</div></div>
      <div class="detail-field"><div class="detail-label">Nº de Módulos</div><div class="detail-value">${a.num_modulos||1}</div></div>
    </div>
    <div class="divider"></div>
    <div class="form-section-title">Planejamento pedagógico</div>
    <div class="detail-field"><div class="detail-label">Justificativa da oferta</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.justificativa_oferta)}</div></div>
    <div class="detail-field"><div class="detail-label">Amparo legal</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.amparo_legal)}</div></div>
    <div class="detail-field"><div class="detail-label">Competência (oferta)</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.competencia_texto)}</div></div>
    <div class="detail-field"><div class="detail-label">Objetivos específicos</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.objetivos_especificos)}</div></div>
    <div class="divider"></div>
    <div class="form-section-title">Objetivo geral, ementa e conteúdos</div>
    <div class="detail-field"><div class="detail-label">Objetivo Geral</div><div class="detail-value" style="line-height:1.6;">${fmtAE(a.objetivo_geral)}</div></div>
    <div class="detail-field"><div class="detail-label">Ementa</div><div class="detail-value" style="line-height:1.6;white-space:pre-line;">${fmtAE(a.ementa)}</div></div>
    <div class="detail-field"><div class="detail-label">Conteúdo Programático</div><div class="detail-value" style="line-height:1.8;white-space:pre-line;background:var(--gray-50);padding:12px;border-radius:8px;font-size:13px;">${fmtAE(a.conteudo_programatico)}</div></div>
    <div class="detail-field"><div class="detail-label">Metodologia</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.metodologia)}</div></div>
    <div class="divider"></div>
    <div class="form-section-title">Modalidade, carga e infraestrutura</div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Modalidade</div><div class="detail-value">${fmtAE(a.modalidade)}</div></div>
      <div class="detail-field"><div class="detail-label">Carga Horária</div><div class="detail-value">${a.carga_horaria||0} h/a</div></div>
      <div class="detail-field"><div class="detail-label">Duração</div><div class="detail-value">${fmtAE(a.duracao)}</div></div>
      <div class="detail-field"><div class="detail-label">Público-Alvo</div><div class="detail-value">${fmtAE(a.publico_alvo)}</div></div>
      <div class="detail-field"><div class="detail-label">Espaço físico</div><div class="detail-value">${fmtAE(a.espaco_fisico)}</div></div>
      <div class="detail-field"><div class="detail-label">Plataforma virtual</div><div class="detail-value">${fmtAE(a.plataforma_virtual)}</div></div>
    </div>
    <div class="divider"></div>
    <div class="form-section-title">Recursos (materiais, tecnológicos, humanos)</div>
    <div class="detail-field"><div class="detail-label">Recursos materiais</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.recursos_materiais)}</div></div>
    <div class="detail-field"><div class="detail-label">Recursos tecnológicos</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.recursos_tecnologicos)}</div></div>
    <div class="detail-field"><div class="detail-label">Recursos humanos</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.recursos_humanos)}</div></div>
    <div class="divider"></div>
    <div class="form-section-title">Avaliação</div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Instrumento — aprendizagem</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(instAp)}</div></div>
      <div class="detail-field"><div class="detail-label">Instrumento — reação</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.instrumento_avaliacao_reacao)}</div></div>
      <div class="detail-field"><div class="detail-label">Instrumento — transferência</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.instrumento_avaliacao_transferencia)}</div></div>
    </div>
    <div class="divider"></div>
    <div class="form-section-title">Matrícula, certificação e bibliografia</div>
    <div class="detail-field"><div class="detail-label">Critérios de matrícula</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.criterios_matricula)}</div></div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Nº de Vagas</div><div class="detail-value">${a.num_vagas != null && a.num_vagas !== '' ? a.num_vagas : '-'}</div></div>
      <div class="detail-field"><div class="detail-label">Frequência Mínima</div><div class="detail-value">${a.frequencia_minima != null && a.frequencia_minima !== '' ? a.frequencia_minima + '%' : '-'}</div></div>
    </div>
    <div class="detail-field"><div class="detail-label">Critérios de certificação</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.criterio_certificacao)}</div></div>
    <div class="detail-field"><div class="detail-label">Bibliografia</div><div class="detail-value" style="white-space:pre-line;">${fmtAE(a.bibliografia)}</div></div>
    ${(a.competencias_vinculadas && a.competencias_vinculadas.length) ? `
    <div class="divider"></div>
    <div class="detail-field">
      <div class="detail-label">Competências da MCN vinculadas (registros)</div>
      <div class="detail-value" style="font-size:13px;line-height:1.5;">${(a.competencias_vinculadas||[]).map((cid) => {
        const m = (getStorage(STORAGE_KEYS.matriz)||[]).find((x) => idEquals(x.id, cid));
        return m ? `• ${m.competencia}` : `• (${cid})`;
      }).join('<br>')}</div>
    </div>` : ''}
  `;
  openModal(a.nome, body, '<button class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>', true);
}

// ── Form (cadastro/edição) ──────────────────────────────────────────────────

export function openAcaoForm(id = null, cloneFromId = null) {
  if (isSomenteLeitura()) return;
  const data = getStorage(STORAGE_KEYS.acoes) || [];
  let a = {};
  if (id) {
    a = data.find((x) => idEquals(x.id, id)) || {};
  } else if (cloneFromId) {
    const src = data.find((x) => idEquals(x.id, cloneFromId));
    if (src) {
      a = JSON.parse(JSON.stringify(src));
      delete a.id;
      delete a.data_criacao;
    }
  }
  const eu = acaoEixoUnidadeFromLegacy(a);
  const instLeg = a.instrumento_avaliacao_aprendizagem || a.instrumento_avaliacao || '';
  const modOpts = ['EaD','Presencial','Semipresencial','Híbrido'].map((o) => `<option ${a.modalidade===o?'selected':''}>${o}</option>`).join('');
  const statOpts = ['Ativo','Inativo','Em elaboração'].map((o) => `<option ${a.status===o?'selected':''}>${o}</option>`).join('');
  // Preserva tipo legado/importado que não está na lista padrão (ex.: "Formação Profissional"
  // vindo de planilha XLSX). Sem isso, o select assumia a primeira opção e sobrescrevia o valor.
  const tipoStandardOpts = ['Curso','Módulo','Disciplina','Oficina','Seminário','Palestra'];
  const tipoAtual = (a.tipo || '').trim();
  const tipoExtra = tipoAtual && !tipoStandardOpts.includes(tipoAtual)
    ? `<option selected>${escapeHtmlStr(tipoAtual)}</option>`
    : '';
  const tipoOpts = tipoExtra
    + tipoStandardOpts.map((o) => `<option ${tipoAtual===o?'selected':''}>${o}</option>`).join('');
  const yn = (v) => {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'sim' || s === 's' || v === true || v === 1) return 'Sim';
    if (s === 'não' || s === 'nao' || s === 'n' || v === false || v === 0) return 'Não';
    return '';
  };
  const selTrilha = yn(a.e_trilha);
  const selModulo = yn(a.e_modulo);

  const baseNovaOpts = !id ? `
    <div class="form-section">
      <div class="form-section-title">Nova ação — base opcional</div>
      <p style="font-size:12px;color:var(--gray-600);margin:-4px 0 10px;">Carregue uma ação existente como modelo. Ao salvar, será criado um <strong>novo</strong> registro (não altera o original).</p>
      <div class="form-group form-full">
        <label>Copiar dados de</label>
        <select id="af-clone-base" onchange="var v=this.value;if(v){openAcaoForm(null,v);}">
          <option value="">— Em branco —</option>
          ${data.map((x) => `<option value="${x.id}" ${idEquals(x.id, cloneFromId)?'selected':''}>${(x.nome||'Sem nome').replace(/</g,'&lt;').substring(0,90)}${(x.codigo?' ('+String(x.codigo).replace(/</g,'')+')':'')}</option>`).join('')}
        </select>
      </div>
    </div>` : '';

  const body = `
    <input type="hidden" id="af-row-id" value="${id||''}">
    ${baseNovaOpts}
    <div class="form-section">
      <div class="form-section-title">Contexto (cadastro único)</div>
      <div class="form-grid">
        <div class="form-group"><label>Estado</label><input type="text" id="af-estado" value="${a.estado||''}" placeholder="Ex: Distrito Federal"></div>
        <div class="form-group"><label>Sigla Estado</label><input type="text" id="af-sigla-estado" value="${a.sigla_estado||''}" placeholder="DF"></div>
        <div class="form-group"><label>É Trilha?</label>
          <select id="af-e-trilha">
            <option value="" ${!selTrilha?'selected':''}>—</option>
            <option ${selTrilha==='Sim'?'selected':''}>Sim</option>
            <option ${selTrilha==='Não'?'selected':''}>Não</option>
          </select>
        </div>
        <div class="form-group"><label>É Módulo?</label>
          <select id="af-e-modulo">
            <option value="" ${!selModulo?'selected':''}>—</option>
            <option ${selModulo==='Sim'?'selected':''}>Sim</option>
            <option ${selModulo==='Não'?'selected':''}>Não</option>
          </select>
        </div>
        <div class="form-group form-full"><label>Módulos associados</label><textarea id="af-modulos-associados" rows="2" placeholder="Referência a outros módulos ou trilhas">${a.modulos_associados||''}</textarea></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Alinhamento MCN (texto livre)</div>
      <div class="form-grid">
        <div class="form-group form-full"><label>Competência MCN</label><input type="text" id="af-competencia-mcn" value="${a.competencia_mcn||''}"></div>
        <div class="form-group"><label>Eixo funcional MCN</label><input type="text" id="af-eixo-func-mcn" value="${a.eixo_funcional_mcn||''}"></div>
        <div class="form-group"><label>Unidade temática MCN</label><input type="text" id="af-unidade-mcn" value="${a.unidade_tematica_mcn||''}"></div>
      </div>
      <div class="form-group"><label>Conhecimento crítico e para a prática</label><textarea id="af-conhecimento-mcn" rows="2">${a.conhecimento_critico_mcn||''}</textarea></div>
      <div class="form-group"><label>Objetivo de aprendizagem MCN</label><textarea id="af-obj-aprend-mcn" rows="2">${a.objetivo_aprendizagem_mcn||''}</textarea></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Identificação</div>
      <div class="form-grid">
        <div class="form-group"><label>Código / ID AE</label><input type="text" id="af-codigo" value="${a.codigo||''}" placeholder="AE_ESPEN00"></div>
        <div class="form-group"><label>Tipo</label><select id="af-tipo">${tipoOpts}</select></div>
        <div class="form-group form-full"><label>Nome da Ação *</label><input type="text" id="af-nome" value="${a.nome||''}" placeholder="Nome completo da ação educativa"></div>
        <div class="form-group"><label>Área Demandante</label><input type="text" id="af-area" value="${a.area_demandante||''}" placeholder="Ex: SENAPPEN/DIRPP"></div>
        <div class="form-group"><label>Escola Proponente</label><input type="text" id="af-escola" value="${a.escola_proponente||'ESPEN'}"></div>
        <div class="form-group"><label>Eixo (oferta)</label><input type="text" id="af-eixo" value="${eu.eixo||''}" placeholder="Item 6 do cadastro único"></div>
        <div class="form-group"><label>Unidade (oferta)</label><input type="text" id="af-unidade" value="${eu.unidade||''}" placeholder="Item 7 do cadastro único"></div>
        <div class="form-group"><label>Status</label><select id="af-status">${statOpts}</select></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Planejamento pedagógico</div>
      <p style="font-size:12px;color:var(--gray-600);margin:-4px 0 10px;">Campos com borda laranja podem ser preenchidos pela similaridade com a matriz (botão em "Objetivo e conteúdos").</p>
      <div class="form-group"><label>Justificativa da oferta</label><textarea id="af-justificativa" rows="3">${a.justificativa_oferta||''}</textarea></div>
      <div class="form-group"><label>Amparo legal</label><textarea id="af-amparo" rows="2">${a.amparo_legal||''}</textarea></div>
      <div class="form-group"><label>Competência (oferta)</label><textarea id="af-competencia-texto" rows="2">${a.competencia_texto||''}</textarea></div>
      <div class="form-group"><label>Objetivos específicos</label><textarea id="af-objetivos-especificos" rows="3">${a.objetivos_especificos||''}</textarea></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Objetivo geral e conteúdos</div>
      <div style="margin-bottom:12px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="sugerirCamposAcaoPorMatriz()"><i class="fas fa-magic"></i> Preencher por similaridade com a matriz</button>
      </div>
      <div class="form-group"><label>Objetivo Geral *</label><textarea id="af-objetivo" rows="3">${a.objetivo_geral||''}</textarea></div>
      <div class="form-group"><label>Ementa</label><textarea id="af-ementa" rows="3">${a.ementa||''}</textarea></div>
      <div class="form-group"><label>Conteúdo Programático</label><textarea id="af-conteudo" rows="5">${a.conteudo_programatico||''}</textarea></div>
      <div class="form-group"><label>Metodologia</label><textarea id="af-metodologia" rows="2">${a.metodologia||''}</textarea></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Competências da MCN (vínculo opcional)</div>
      <div style="max-height:160px;overflow-y:auto;border:1.5px solid var(--gray-200);border-radius:8px;padding:10px;">
        ${(getStorage(STORAGE_KEYS.matriz)||[]).filter((m) => !isMatrizRegistroArquivado(m)).slice(0, 150).map((m) => `
        <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;padding:4px 0;cursor:pointer;">
          <input type="checkbox" name="af-comp-vinc" value="${m.id}" style="margin-top:3px;" ${(a.competencias_vinculadas||[]).includes(m.id)?'checked':''}>
          <span>${(m.competencia||'').substring(0, 120)}${(m.competencia||'').length>120?'…':''}</span>
        </label>`).join('') || '<p style="font-size:12px;color:var(--gray-500);">Nenhum registro na matriz.</p>'}
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Modalidade, carga e infraestrutura</div>
      <div class="form-grid">
        <div class="form-group"><label>Modalidade *</label><select id="af-modalidade">${modOpts}</select></div>
        <div class="form-group"><label>Carga Horária (h/a) *</label><input type="number" id="af-ch" value="${a.carga_horaria||''}" min="1" placeholder="0"></div>
        <div class="form-group"><label>Duração</label><input type="text" id="af-duracao" value="${a.duracao||''}" placeholder="Ex: 4 semanas"></div>
        <div class="form-group"><label>Nº de Módulos</label><input type="number" id="af-modulos" value="${a.num_modulos||1}" min="1"></div>
        <div class="form-group form-full"><label>Público-Alvo</label><input type="text" id="af-publico" value="${a.publico_alvo||''}" placeholder="Ex: Policiais Penais"></div>
        <div class="form-group"><label>Espaço físico</label><input type="text" id="af-espaco-fisico" value="${a.espaco_fisico||''}"></div>
        <div class="form-group form-full"><label>Plataforma virtual de ensino-aprendizagem</label><input type="text" id="af-plataforma" value="${a.plataforma_virtual||''}"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Recursos (itens 19–21)</div>
      <div class="form-group"><label>Recursos materiais</label><textarea id="af-rec-mat" rows="2">${a.recursos_materiais||''}</textarea></div>
      <div class="form-group"><label>Recursos tecnológicos</label><textarea id="af-rec-tec" rows="2">${a.recursos_tecnologicos||''}</textarea></div>
      <div class="form-group"><label>Recursos humanos</label><textarea id="af-rec-hum" rows="2">${a.recursos_humanos||''}</textarea></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Avaliação (itens 22–24)</div>
      <div class="form-grid">
        <div class="form-group form-full"><label>Instrumento — aprendizagem</label><input type="text" id="af-inst-aprend" value="${instLeg}"></div>
        <div class="form-group form-full"><label>Instrumento — reação</label><input type="text" id="af-inst-reacao" value="${a.instrumento_avaliacao_reacao||''}"></div>
        <div class="form-group form-full"><label>Instrumento — transferência</label><input type="text" id="af-inst-transf" value="${a.instrumento_avaliacao_transferencia||''}"></div>
      </div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Matrícula, certificação e bibliografia</div>
      <div class="form-group"><label>Critérios de matrícula</label><textarea id="af-criterios-matricula" rows="2">${a.criterios_matricula||''}</textarea></div>
      <div class="form-grid">
        <div class="form-group"><label>Nº de Vagas</label><input type="number" id="af-vagas" value="${a.num_vagas||''}" min="1"></div>
        <div class="form-group"><label>Frequência mínima (%)</label><input type="number" id="af-freq" value="${a.frequencia_minima||90}" min="0" max="100"></div>
      </div>
      <div class="form-group"><label>Critérios de certificação</label><textarea id="af-criterio" rows="2">${a.criterio_certificacao||''}</textarea></div>
      <div class="form-group"><label>Bibliografia</label><textarea id="af-bibliografia" rows="3">${a.bibliografia||''}</textarea></div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveAcao()"><i class="fas fa-save"></i> ${id?'Salvar': cloneFromId ? 'Cadastrar como nova' : 'Cadastrar'}</button>
  `;
  const titulo = id ? 'Editar Ação Educativa' : (cloneFromId ? 'Nova Ação Educativa (a partir de modelo)' : 'Nova Ação Educativa');
  openModal(titulo, body, footer, true);
}

export function editAcao(id) { openAcaoForm(id); }

export function saveAcao() {
  const id = (document.getElementById('af-row-id') && document.getElementById('af-row-id').value) || '';
  const nome = document.getElementById('af-nome').value.trim();
  const objetivo = document.getElementById('af-objetivo').value.trim();
  const ch = document.getElementById('af-ch').value;
  if (!nome || !objetivo || !ch) { showToast('Preencha os campos obrigatórios (*)', 'warning'); return; }
  const codigoVal = document.getElementById('af-codigo').value.trim();
  const codigoNorm = normalizeActionCode(codigoVal);
  const todas = getStorage(STORAGE_KEYS.acoes) || [];
  if (!id && codigoVal && todas.some((x) => x.codigo && normalizeActionCode(x.codigo) === codigoNorm)) {
    showToast('Já existe uma ação com este código. Altere o código para cadastrar como nova.', 'warning');
    return;
  }
  if (id && codigoVal) {
    const outro = todas.find((x) => !idEquals(x.id, id) && x.codigo && normalizeActionCode(x.codigo) === codigoNorm);
    if (outro) { showToast('Outra ação já usa este código.', 'warning'); return; }
  }
  const competencias_vinculadas = Array.from(document.querySelectorAll('input[name="af-comp-vinc"]:checked')).map((cb) => cb.value);
  const eixo = document.getElementById('af-eixo').value.trim();
  const unidade = document.getElementById('af-unidade').value.trim();
  const eTrilha = document.getElementById('af-e-trilha').value;
  const eModulo = document.getElementById('af-e-modulo').value;
  const instAp = document.getElementById('af-inst-aprend').value.trim();
  const rec = {
    nome, objetivo_geral: objetivo,
    codigo: document.getElementById('af-codigo').value.trim(),
    tipo: document.getElementById('af-tipo').value,
    estado: document.getElementById('af-estado').value.trim(),
    sigla_estado: document.getElementById('af-sigla-estado').value.trim(),
    e_trilha: eTrilha || '',
    e_modulo: eModulo || '',
    modulos_associados: document.getElementById('af-modulos-associados').value.trim(),
    competencia_mcn: document.getElementById('af-competencia-mcn').value.trim(),
    eixo_funcional_mcn: document.getElementById('af-eixo-func-mcn').value.trim(),
    unidade_tematica_mcn: document.getElementById('af-unidade-mcn').value.trim(),
    conhecimento_critico_mcn: document.getElementById('af-conhecimento-mcn').value.trim(),
    objetivo_aprendizagem_mcn: document.getElementById('af-obj-aprend-mcn').value.trim(),
    area_demandante: document.getElementById('af-area').value.trim(),
    escola_proponente: document.getElementById('af-escola').value.trim(),
    eixo,
    unidade,
    eixo_tematico: syncEixoTematicoLegado(eixo, unidade),
    justificativa_oferta: document.getElementById('af-justificativa').value.trim(),
    amparo_legal: document.getElementById('af-amparo').value.trim(),
    competencia_texto: document.getElementById('af-competencia-texto').value.trim(),
    objetivos_especificos: document.getElementById('af-objetivos-especificos').value.trim(),
    status: document.getElementById('af-status').value,
    ementa: document.getElementById('af-ementa').value.trim(),
    conteudo_programatico: document.getElementById('af-conteudo').value.trim(),
    metodologia: document.getElementById('af-metodologia').value.trim(),
    duracao: document.getElementById('af-duracao').value.trim(),
    espaco_fisico: document.getElementById('af-espaco-fisico').value.trim(),
    plataforma_virtual: document.getElementById('af-plataforma').value.trim(),
    recursos_materiais: document.getElementById('af-rec-mat').value.trim(),
    recursos_tecnologicos: document.getElementById('af-rec-tec').value.trim(),
    recursos_humanos: document.getElementById('af-rec-hum').value.trim(),
    carga_horaria: parseInt(ch),
    num_modulos: parseInt(document.getElementById('af-modulos').value) || 1,
    modalidade: document.getElementById('af-modalidade').value,
    num_vagas: parseInt(document.getElementById('af-vagas').value) || 0,
    publico_alvo: document.getElementById('af-publico').value.trim(),
    frequencia_minima: parseInt(document.getElementById('af-freq').value) || 90,
    instrumento_avaliacao_aprendizagem: instAp,
    instrumento_avaliacao_reacao: document.getElementById('af-inst-reacao').value.trim(),
    instrumento_avaliacao_transferencia: document.getElementById('af-inst-transf').value.trim(),
    instrumento_avaliacao: instAp,
    criterios_matricula: document.getElementById('af-criterios-matricula').value.trim(),
    criterio_certificacao: document.getElementById('af-criterio').value.trim(),
    bibliografia: document.getElementById('af-bibliografia').value.trim(),
    competencias_vinculadas,
  };
  const data = getStorage(STORAGE_KEYS.acoes) || [];
  if (id) {
    const idx = data.findIndex((x) => idEquals(x.id, id));
    if (idx < 0) return;
    const merged = { ...data[idx], ...rec };
    if (usaFilaModeracao()) {
      pushFilaModeracao('acao_upsert', { editId: id, registro: merged });
      closeModalBtn();
      showToast('Alteração enviada para aprovação do administrador.', 'info');
      return;
    }
    data[idx] = merged;
  } else {
    const novo = { id: genId(), ...rec, data_criacao: new Date().toISOString().split('T')[0] };
    if (usaFilaModeracao()) {
      pushFilaModeracao('acao_upsert', { editId: null, registro: novo });
      closeModalBtn();
      showToast('Cadastro enviado para aprovação do administrador.', 'info');
      return;
    }
    data.push(novo);
  }
  setStorage(STORAGE_KEYS.acoes, data);
  closeModalBtn();
  showToast(id ? 'Ação atualizada!' : 'Ação cadastrada!', 'success');
  renderAcoesGrid();
}

export function deleteAcao(id) {
  if (!confirm('Deseja excluir esta ação educativa?')) return;
  if (usaFilaModeracao()) {
    const data = getStorage(STORAGE_KEYS.acoes) || [];
    const row = data.find((x) => idEquals(x.id, id));
    pushFilaModeracao('acao_excluir', {
      id,
      nome_acao: row ? (row.nome || '').trim() : '',
      codigo_acao: row ? (row.codigo || '').trim() : '',
    });
    showToast('Solicitação de exclusão enviada ao administrador.', 'info');
    renderAcoesGrid();
    return;
  }
  const data = (getStorage(STORAGE_KEYS.acoes) || []).filter((x) => !idEquals(x.id, id));
  setStorage(STORAGE_KEYS.acoes, data);
  showToast('Ação excluída.', 'success');
  renderAcoesGrid();
}

Object.assign(globalThis, {
  renderAcoes,
  renderAcoesGrid,
  toggleAcoesView,
  viewAcaoDetail,
  openAcaoForm,
  editAcao,
  saveAcao,
  deleteAcao,
  sugerirCamposAcaoPorMatriz,
});
