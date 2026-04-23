/**
 * ESPEN – js/dashboard.js
 * Dashboard: KPIs, gráficos Chart.js, feed de atividades.
 */

let dashCharts = {};

function renderDashboard() {
  const users    = JSON.parse(localStorage.getItem(LS_USERS)        || '[]');
  const comps    = JSON.parse(localStorage.getItem(LS_COMPETENCIAS)  || '[]');
  const acoes    = JSON.parse(localStorage.getItem(LS_ACOES)         || '[]');
  const trilhas  = JSON.parse(localStorage.getItem(LS_TRILHAS)       || '[]');
  const pdis     = JSON.parse(localStorage.getItem(LS_PDIS)          || '[]');
  const activities = JSON.parse(localStorage.getItem(LS_ACTIVITY)    || '[]');

  // Total real de competências (seed mostra 50, total conceitual = 602)
  const totalComps = 602;

  document.getElementById('topbar-actions').innerHTML = '';
  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Bem-vindo(a), ${currentUser?.nome?.split(' ')[0] || 'Servidor'}!</h2>
        <p>Visão geral do Sistema de Gestão por Competências – SENAPPEN</p>
      </div>
      <span class="badge badge-navy" style="font-size:12px;">
        <i class="fas fa-calendar-alt"></i> ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </span>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon navy"><i class="fas fa-brain"></i></div>
        <div class="kpi-body">
          <div class="kpi-value" id="kpi-comps">${totalComps}</div>
          <div class="kpi-label">Total Competências</div>
          <div class="kpi-trend up"><i class="fas fa-arrow-up"></i> MCN 2026</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon gold"><i class="fas fa-graduation-cap"></i></div>
        <div class="kpi-body">
          <div class="kpi-value" id="kpi-acoes">${acoes.length || 36}</div>
          <div class="kpi-label">Ações Educativas</div>
          <div class="kpi-trend up"><i class="fas fa-arrow-up"></i> +2 este mês</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon success"><i class="fas fa-route"></i></div>
        <div class="kpi-body">
          <div class="kpi-value" id="kpi-trilhas">${trilhas.length}</div>
          <div class="kpi-label">Trilhas de Aprendizagem</div>
          <div class="kpi-trend ${trilhas.length > 0 ? 'up' : ''}">
            ${trilhas.length > 0 ? '<i class="fas fa-arrow-up"></i> Ativas' : 'Nenhuma criada'}
          </div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon info"><i class="fas fa-users"></i></div>
        <div class="kpi-body">
          <div class="kpi-value" id="kpi-users">${users.length}</div>
          <div class="kpi-label">Total Usuários</div>
          <div class="kpi-trend up"><i class="fas fa-arrow-up"></i> ${users.filter(u => u.ativo).length} ativos</div>
        </div>
      </div>
    </div>

    <!-- Charts row 1 -->
    <div class="charts-grid-3 mb-20">
      <div class="chart-card">
        <h3>Distribuição por Eixo Funcional</h3>
        <p>Competências por eixo (MCN 2026)</p>
        <div class="chart-container">
          <canvas id="chart-eixo"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>Tipologia de Complexidade</h3>
        <p>Básico · Intermediário · Avançado</p>
        <div class="chart-container">
          <canvas id="chart-complexidade"></canvas>
        </div>
      </div>
      <div class="chart-card">
        <h3>Categoria</h3>
        <p>Especialista vs Geral</p>
        <div class="chart-container">
          <canvas id="chart-categoria"></canvas>
        </div>
      </div>
    </div>

    <!-- Charts row 2 + Activity -->
    <div class="charts-grid">
      <div class="chart-card">
        <h3>Competências por Cargo</h3>
        <p>Distribuição entre os cargos do DEPEN</p>
        <div class="chart-container">
          <canvas id="chart-cargo"></canvas>
        </div>
      </div>
      <div class="card mb-0">
        <div class="card-header">
          <h3><i class="fas fa-history"></i> Atividade Recente</h3>
        </div>
        <div id="activity-feed" class="activity-list">
          ${activities.length === 0 ? renderActivityEmpty() : activities.slice(0, 8).map(renderActivityItem).join('')}
        </div>
      </div>
    </div>

    <!-- PDI Summary -->
    ${pdis.length > 0 ? renderPdiSummary(pdis) : ''}
  `;

  // Renderiza gráficos após DOM pronto
  setTimeout(() => {
    renderChartEixo(comps);
    renderChartComplexidade(comps);
    renderChartCategoria(comps);
    renderChartCargo(comps);
  }, 100);
}

function renderActivityEmpty() {
  return `<div class="empty-state" style="padding:30px 20px;">
    <i class="fas fa-history"></i>
    <p>Nenhuma atividade registrada ainda.</p>
  </div>`;
}

function renderActivityItem(act) {
  const icons = { create: 'fa-plus', update: 'fa-edit', delete: 'fa-trash', login: 'fa-sign-in-alt', export: 'fa-file-export' };
  return `<div class="activity-item">
    <div class="activity-icon ${act.type}"><i class="fas ${icons[act.type] || 'fa-circle'}"></i></div>
    <div class="activity-content">
      <div class="activity-text">${act.text}</div>
      <div class="activity-time">${timeAgo(act.time)}</div>
    </div>
  </div>`;
}

function renderPdiSummary(pdis) {
  const n = (pdis || []).length;
  return `
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-clipboard-list"></i> Planos de ensino</h3>
        <button class="btn btn-sm btn-outline" onclick="navigateTo('pdi')">Ver todos</button>
      </div>
      <div class="form-grid">
        <div style="text-align:center;padding:14px;background:rgba(26,35,126,.08);border-radius:var(--radius);">
          <div style="font-size:28px;font-weight:800;color:var(--navy)">${n}</div>
          <div style="font-size:12px;color:var(--gray-600);margin-top:4px;">Planos cadastrados</div>
        </div>
      </div>
    </div>`;
}

/* ── Cores dos gráficos ──────────────────────────────────────── */
const CHART_COLORS = {
  navy:  '#1a237e',
  navyL: '#3949ab',
  gold:  '#ffc107',
  goldD: '#f9a825',
  green: '#28a745',
  teal:  '#17a2b8',
  red:   '#dc3545',
  purple: '#6f42c1',
  palette: [
    '#1a237e', '#283593', '#3949ab', '#42a5f5',
    '#ffc107', '#f9a825', '#28a745', '#17a2b8',
  ],
};

function destroyChart(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); delete dashCharts[id]; }
}

/* ── Gráfico Eixo Funcional ──────────────────────────────────── */
function renderChartEixo(comps) {
  destroyChart('eixo');
  const eixos = window.ESPEN_DATA?.EIXOS || [];
  // Dados conceituais MCN 2026 (totais reais distribuídos)
  const totaisPorEixo = {
    'Eixo 1 – Gestão Penitenciária':  118,
    'Eixo 2 – Segurança e Custódia':  132,
    'Eixo 3 – Reinserção Social':      98,
    'Eixo 4 – Saúde Penitenciária':    88,
    'Eixo 5 – Gestão de Pessoas':      96,
    'Eixo 6 – Suporte Organizacional': 70,
  };
  const labels = eixos.map(e => e.replace('Eixo ', 'E').replace(/ – .+/, ''));
  const values = eixos.map(e => totaisPorEixo[e] || 0);

  const ctx = document.getElementById('chart-eixo');
  if (!ctx) return;
  dashCharts.eixo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Competências',
        data: values,
        backgroundColor: CHART_COLORS.palette,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f3f4' } },
        x: { grid: { display: false } },
      },
    },
  });
}

/* ── Gráfico Complexidade (Pie) ──────────────────────────────── */
function renderChartComplexidade(comps) {
  destroyChart('complexidade');
  // Dados conceituais
  const data = { Básico: 180, Intermediário: 254, Avançado: 168 };
  const ctx  = document.getElementById('chart-complexidade');
  if (!ctx) return;
  dashCharts.complexidade = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [CHART_COLORS.teal, CHART_COLORS.navy, CHART_COLORS.gold],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
      },
    },
  });
}

/* ── Gráfico Categoria (Donut) ───────────────────────────────── */
function renderChartCategoria(comps) {
  destroyChart('categoria');
  const data = { Especialista: 244, Geral: 358 };
  const ctx  = document.getElementById('chart-categoria');
  if (!ctx) return;
  dashCharts.categoria = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(data),
      datasets: [{
        data: Object.values(data),
        backgroundColor: [CHART_COLORS.navy, CHART_COLORS.gold],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
      },
    },
  });
}

/* ── Gráfico Cargo (Grouped Bar) ─────────────────────────────── */
function renderChartCargo(comps) {
  destroyChart('cargo');
  // Dados conceituais
  const cargos = ['Agente Penitenciário', 'Especialista Assist.', 'Todos os Cargos'];
  const basico = [48, 52, 80];
  const interm = [65, 80, 109];
  const avanc  = [40, 88, 40];

  const ctx = document.getElementById('chart-cargo');
  if (!ctx) return;
  dashCharts.cargo = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cargos,
      datasets: [
        { label: 'Básico',        data: basico, backgroundColor: CHART_COLORS.teal,  borderRadius: 3 },
        { label: 'Intermediário', data: interm, backgroundColor: CHART_COLORS.navy,  borderRadius: 3 },
        { label: 'Avançado',      data: avanc,  backgroundColor: CHART_COLORS.gold,  borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: {
        y: { beginAtZero: true, stacked: false, grid: { color: '#f1f3f4' } },
        x: { grid: { display: false } },
      },
    },
  });
}
