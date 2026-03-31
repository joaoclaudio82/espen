/**
 * ESPEN – js/app.js
 * Núcleo da aplicação: inicialização, roteamento, utilitários globais.
 */

/* ── Chaves localStorage ─────────────────────────────────────── */
const LS_COMPETENCIAS = 'espen_competencias';
const LS_ACOES        = 'espen_acoes';
const LS_TRILHAS      = 'espen_trilhas';
const LS_PDIS         = 'espen_pdis';
const LS_ACTIVITY     = 'espen_activity';

/* ── Estado global ───────────────────────────────────────────── */
let currentPage  = 'dashboard';
let currentUser  = null;

/* ── Toast ───────────────────────────────────────────────────── */
function showToast(message, type = 'info', duration = 4000) {
  const icons = { success: 'fa-check-circle', danger: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span class="toast-text">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ── Log de atividade ────────────────────────────────────────── */
function logActivity(type, text) {
  const activities = JSON.parse(localStorage.getItem(LS_ACTIVITY) || '[]');
  activities.unshift({ type, text, time: Date.now() });
  localStorage.setItem(LS_ACTIVITY, JSON.stringify(activities.slice(0, 50)));
}

/* ── Formatação de data ──────────────────────────────────────── */
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'agora mesmo';
  if (mins  < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
}

/* ── UUID simples ────────────────────────────────────────────── */
function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Truncar texto ───────────────────────────────────────────── */
function truncate(str, n = 40) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/* ── Exportar CSV ────────────────────────────────────────────── */
function exportCSV(rows, filename) {
  const csv = rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  showToast(`CSV "${filename}" exportado com sucesso.`, 'success');
}

/* ── Inicialização de dados ──────────────────────────────────── */
function initializeData() {
  seedAdmin();

  if (!localStorage.getItem(LS_COMPETENCIAS)) {
    const data = window.ESPEN_DATA;
    if (data && data.SEED_COMPETENCIAS) {
      const comps = data.SEED_COMPETENCIAS.map(c => ({
        ...c,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      localStorage.setItem(LS_COMPETENCIAS, JSON.stringify(comps));
    }
  }

  if (!localStorage.getItem(LS_ACOES)) {
    const data = window.ESPEN_DATA;
    if (data && data.SEED_ACOES) {
      localStorage.setItem(LS_ACOES, JSON.stringify(data.SEED_ACOES));
    }
  }

  if (!localStorage.getItem(LS_TRILHAS)) localStorage.setItem(LS_TRILHAS, '[]');
  if (!localStorage.getItem(LS_PDIS))    localStorage.setItem(LS_PDIS, '[]');
  if (!localStorage.getItem(LS_ACTIVITY)) localStorage.setItem(LS_ACTIVITY, '[]');
}

/* ── Roteamento / navegação ──────────────────────────────────── */
function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  closeSidebar();

  const pageContent   = document.getElementById('page-content');
  const topbarTitle   = document.getElementById('topbar-title');
  const topbarActions = document.getElementById('topbar-actions');

  const pages = {
    dashboard: { title: 'Dashboard',                 render: renderDashboard },
    matriz:    { title: 'Matriz de Competências',    render: renderMatriz    },
    acoes:     { title: 'Ações Educativas',          render: renderAcoes     },
    trilhas:   { title: 'Trilhas de Aprendizagem',   render: renderTrilhas   },
    pdi:       { title: 'Planos de Desenvolvimento', render: renderPDI       },
    usuarios:  { title: 'Gestão de Usuários',        render: renderUsuarios  },
    config:    { title: 'Configurações',             render: renderConfig    },
  };

  const pg = pages[page];
  if (!pg) return;

  if (page === 'usuarios' && currentUser?.acesso !== 'Administrador') {
    showToast('Acesso restrito a administradores.', 'danger');
    navigateTo('dashboard');
    return;
  }

  topbarTitle.textContent = pg.title;
  topbarActions.innerHTML = '';
  pageContent.innerHTML   = '<div style="padding:40px;text-align:center;"><div class="spinner"></div></div>';
  setTimeout(() => pg.render(), 60);
}

/* ── Sidebar toggle ──────────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

/* ── Entra no app ────────────────────────────────────────────── */
function enterApp() {
  currentUser = getCurrentUser();
  if (!currentUser) return;

  document.getElementById('auth-screen').style.display = 'none';
  const appScreen = document.getElementById('app-screen');
  appScreen.classList.add('active');
  document.getElementById('bottom-nav').style.display = 'block';

  const initials = currentUser.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  document.getElementById('sidebar-user-avatar').textContent = initials;
  document.getElementById('sidebar-user-name').textContent   = currentUser.nome;
  document.getElementById('sidebar-user-role').textContent   = currentUser.acesso;

  const usersNavItem = document.querySelector('.nav-item[data-page="usuarios"]');
  if (usersNavItem) {
    usersNavItem.style.display = currentUser.acesso === 'Administrador' ? '' : 'none';
  }

  navigateTo('dashboard');
}

/* ── Modal global ────────────────────────────────────────────── */
function openModal(id) {
  const overlay = id ? document.getElementById(id) : document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const targets = id
    ? [document.getElementById(id)]
    : document.querySelectorAll('.modal-overlay.active');
  targets.forEach(el => { if (el) el.classList.remove('active'); });
  document.body.style.overflow = '';
}

/* ── Bind de eventos ─────────────────────────────────────────── */
function bindAppEvents() {
  const menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSidebar(); closeModal(); }
  });
}

/* ── Configurações ───────────────────────────────────────────── */
function renderConfig() {
  const topbarActions = document.getElementById('topbar-actions');
  topbarActions.innerHTML = '';

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Configurações</h2>
        <p>Preferências e dados do sistema ESPEN</p>
      </div>
    </div>
    <div class="card mb-20">
      <div class="card-header">
        <h3><i class="fas fa-user-circle"></i> Meu Perfil</h3>
      </div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Nome Completo</div>
          <div class="detail-value">${currentUser?.nome || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">CPF</div>
          <div class="detail-value">${currentUser?.cpf || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">E-mail</div>
          <div class="detail-value">${currentUser?.email || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Cargo</div>
          <div class="detail-value">${currentUser?.cargo || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Nível de Acesso</div>
          <div class="detail-value"><span class="badge badge-navy">${currentUser?.acesso || '—'}</span></div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div class="detail-value"><span class="badge badge-success">Ativo</span></div>
        </div>
      </div>
    </div>
    <div class="card mb-20">
      <div class="card-header">
        <h3><i class="fas fa-database"></i> Dados do Sistema</h3>
      </div>
      <div class="form-grid">
        <div class="detail-item">
          <div class="detail-label">Competências cadastradas</div>
          <div class="detail-value fw-700 text-navy">${JSON.parse(localStorage.getItem(LS_COMPETENCIAS)||'[]').length}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Ações educativas</div>
          <div class="detail-value fw-700 text-navy">${JSON.parse(localStorage.getItem(LS_ACOES)||'[]').length}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Trilhas de aprendizagem</div>
          <div class="detail-value fw-700 text-navy">${JSON.parse(localStorage.getItem(LS_TRILHAS)||'[]').length}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Planos de Desenvolvimento</div>
          <div class="detail-value fw-700 text-navy">${JSON.parse(localStorage.getItem(LS_PDIS)||'[]').length}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3><i class="fas fa-tools"></i> Ferramentas de Manutenção</h3>
      </div>
      <p class="text-muted mb-16" style="font-size:13px;">Atenção: operações em vermelho são irreversíveis.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-outline" onclick="exportAllDataJSON()">
          <i class="fas fa-download"></i> Exportar backup JSON
        </button>
        ${currentUser?.acesso === 'Administrador' ? `
        <button class="btn btn-danger" onclick="confirmResetData()">
          <i class="fas fa-trash-alt"></i> Resetar dados
        </button>` : ''}
      </div>
    </div>`;
}

function exportAllDataJSON() {
  const dump = {
    competencias: JSON.parse(localStorage.getItem(LS_COMPETENCIAS) || '[]'),
    acoes:        JSON.parse(localStorage.getItem(LS_ACOES) || '[]'),
    trilhas:      JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]'),
    pdis:         JSON.parse(localStorage.getItem(LS_PDIS) || '[]'),
    usuarios:     JSON.parse(localStorage.getItem(LS_USERS) || '[]').map(u => ({ ...u, senha: '***' })),
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `espen_backup_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('Backup JSON exportado.', 'success');
}

function confirmResetData() {
  if (!confirm('Isso irá remover TODAS as competências, ações, trilhas e PDIs.\nO administrador será mantido.\n\nDeseja continuar?')) return;
  localStorage.removeItem(LS_COMPETENCIAS);
  localStorage.removeItem(LS_ACOES);
  localStorage.removeItem(LS_TRILHAS);
  localStorage.removeItem(LS_PDIS);
  localStorage.removeItem(LS_ACTIVITY);
  initializeData();
  showToast('Dados reinicializados com os dados padrão.', 'success');
  renderConfig();
}

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initializeData();
  initAuth();
  bindAppEvents();

  currentUser = getCurrentUser();
  if (currentUser) {
    enterApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});
