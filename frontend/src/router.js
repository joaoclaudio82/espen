/**
 * Router/SPA: navegação entre páginas, controle do sidebar e do modal genérico.
 *
 * `navigate(page)` é o ponto único — atualiza estado, destrói charts da página
 * anterior, mostra spinner e dispara o renderer correspondente. Os renderers em
 * si vivem nos módulos `pages/*.js` (ainda transitando do legacy) e são acessados
 * via `globalThis` para evitar import cíclico durante a refatoração.
 */
import { charts, setCharts, setCurrentPage } from './core/state.js';

export const pageMap = {
  dashboard: { title: 'Dashboard', icon: 'fa-home' },
  matriz: { title: 'Matriz de Competências', icon: 'fa-table-cells' },
  acoes: { title: 'Ações Educativas', icon: 'fa-book-open' },
  trilhas: { title: 'Trilhas de Aprendizagem', icon: 'fa-route' },
  pdi: { title: 'Planos de Ensino', icon: 'fa-clipboard-list' },
  usuarios: { title: 'Gestão de Usuários', icon: 'fa-users' },
  moderacao: { title: 'Aprovações de alterações', icon: 'fa-clipboard-check' },
  pendencias_gestor: { title: 'Pendências em validação', icon: 'fa-hourglass-half' },
  sobre: { title: 'Sobre', icon: 'fa-circle-info' },
  configuracoes: { title: 'Configurações', icon: 'fa-gear' },
};

/** Rota → função renderer. Cada renderer recebe nada e escreve em #page-content. */
const PAGE_RENDERERS = {
  dashboard: 'renderDashboard',
  matriz: 'renderMatriz',
  acoes: 'renderAcoes',
  trilhas: 'renderTrilhas',
  pdi: 'renderPDI',
  usuarios: 'renderUsuarios',
  moderacao: 'renderModeracao',
  pendencias_gestor: 'renderPendenciasGestorModeracao',
  sobre: 'renderSobre',
  configuracoes: 'renderConfiguracoes',
};

export function destroyDashboardCharts() {
  Object.keys(charts).forEach((k) => {
    try { charts[k].destroy(); } catch (_) {}
  });
  setCharts({});
}

export function navigate(page) {
  setCurrentPage(page);
  closeSidebar();

  document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((item) => {
    const onclick = item.getAttribute('onclick');
    if (onclick && onclick.includes(`'${page}'`)) item.classList.add('active');
  });

  Object.values(charts).forEach((c) => {
    try { c.destroy(); } catch (_) { /* já destruído ou inexistente */ }
  });
  setCharts({});

  const info = pageMap[page] || { title: page };
  document.getElementById('topbar-title').textContent = info.title;
  document.getElementById('topbar-actions').innerHTML = '';

  const content = document.getElementById('page-content');
  content.innerHTML = '<div class="loading-overlay"><i class="fas fa-spinner fa-spin" style="font-size:24px;margin-right:10px;"></i> Carregando...</div>';

  // Renderers vivem em legacy.js (transição) — resolvidos via globalThis em runtime.
  setTimeout(() => {
    const fn = PAGE_RENDERERS[page] && globalThis[PAGE_RENDERERS[page]];
    if (typeof fn === 'function') {
      fn();
    } else {
      content.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><h3>Em desenvolvimento</h3></div>';
    }
  }, 100);
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('active');
  }
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

/**
 * Modal genérico: substitui título/corpo/rodapé do `#main-modal`.
 *
 * @param {string} title
 * @param {string} bodyHtml
 * @param {string} [footerHtml]
 * @param {boolean} [large=false] aplica classe `modal-lg`
 * @param {string} [extraModalClass='']
 */
export function openModal(title, bodyHtml, footerHtml = '', large = false, extraModalClass = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  const base = large ? 'modal modal-lg' : 'modal';
  document.getElementById('main-modal').className = extraModalClass
    ? `${base} ${extraModalClass}`.trim()
    : base;
  document.getElementById('modal-overlay').classList.add('active');
}

/**
 * Fecha o modal — quando chamada via clique no overlay (com `event`), só fecha
 * se o alvo for o próprio overlay (clique fora do conteúdo).
 */
export function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('active');
}

/** Botão "fechar" no rodapé do modal — sempre fecha. */
export function closeModalBtn() {
  document.getElementById('modal-overlay').classList.remove('active');
}
