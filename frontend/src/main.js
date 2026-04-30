/**
 * Entrypoint do bundle Vite.
 *
 * Ordem de carregamento:
 *   1. Estilos (CSS extraído byte-a-byte do monólito anterior).
 *   2. Bibliotecas externas (Chart.js, docx, pizzip, file-saver, xlsx) e
 *      ícones/fonte para a identidade visual. Algumas são expostas em `window`
 *      para preservar o caminho de uso original (templates ainda usam onclick=).
 *   3. Módulos novos (api/auth/router/state/shared) — carregados via imports.
 *   4. Páginas (pages/*.js) — cada uma registra seu(s) renderer(s) em globalThis
 *      para resolver inline handlers como `onclick="navigate('matriz')"`.
 *   5. Exports DOCX e import Excel.
 *   6. Bootstrap do DOM (boot) — executa restoreSession e dispatch da tela.
 */
import './styles/main.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import { Chart, registerables } from 'chart.js';
import * as docxNs from 'docx';
import { saveAs } from 'file-saver';
import PizZip from 'pizzip';
import * as xlsxNs from 'xlsx';

import { STORAGE_KEYS } from './api/storage.js';
import { maskCPF } from './auth/cpf.js';
import {
  doLogin as doLoginImpl,
  doLogout as doLogoutImpl,
  doRegister as doRegisterImpl,
  getCurrentUser,
  restoreSession,
  setCurrentUser,
  showForgotPassword,
  switchAuthTab,
  updateSidebarUser,
  validateRegisterCPF,
} from './auth/session.js';
import {
  closeModal,
  closeModalBtn,
  closeSidebar,
  navigate,
  openModal,
  toggleSidebar,
} from './router.js';

// Páginas — cada módulo registra seus renderers/handlers em globalThis ao ser
// importado. A ordem aqui é só estética; ES modules garantem dedup.
import './pages/sobre.js';
import './pages/configuracoes.js';
import './pages/usuarios.js';
import './pages/trilhas.js';
import './pages/dashboard.js';
import './pages/matriz.js';
import './pages/acoes.js';
import './pages/pdi.js';
import './pages/moderacao.js';

// Cross-cutting (import/export de planilhas/Word).
import './exports/docx.js';
import './import/excel.js';

// Vite empacota libs CJS de forma inconsistente: às vezes os símbolos vêm
// direto no namespace, outras ficam atrás de `.default`. Normalizamos para
// que módulos legados acessem `window.XLSX.read(...)` / `window.docx.Document`
// como na carga UMD original.
const XLSX = xlsxNs && typeof xlsxNs.read === 'function' ? xlsxNs : (xlsxNs.default || xlsxNs);
const docx = docxNs && docxNs.Document ? docxNs : (docxNs.default || docxNs);

Chart.register(...registerables);
window.Chart = Chart;
window.docx = docx;
window.PizZip = PizZip;
window.saveAs = saveAs;
window.XLSX = XLSX;

// `currentUser` é mantido por `auth/session.js`. Exposto via getter/setter no
// globalThis para que páginas que ainda fazem `currentUser.id` (em vez de
// importar `getCurrentUser`) continuem funcionando como antes do refator.
Object.defineProperty(globalThis, 'currentUser', {
  configurable: true,
  get: () => getCurrentUser(),
  set: (value) => setCurrentUser(value),
});

// Símbolos consumidos por inline handlers nos templates (`onclick="navigate(…)"`,
// etc.). As páginas/exports já se auto-registram em globalThis dentro de seus
// próprios módulos — aqui só ficam os que vêm de módulos não-pages.
Object.assign(globalThis, {
  STORAGE_KEYS,
  // Chrome / navegação / modal
  navigate, closeSidebar, toggleSidebar, openModal, closeModal, closeModalBtn,
  // Auth / formulários
  showForgotPassword, switchAuthTab, validateRegisterCPF, maskCPF,
  updateSidebarUser,
});

function enterApp() {
  const user = getCurrentUser();
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  updateSidebarUser();

  const navUsuarios = document.getElementById('nav-usuarios');
  const navModeracao = document.getElementById('nav-moderacao');
  const navPendGestor = document.getElementById('nav-pendencias-gestor');
  if (user?.acesso !== 'Administrador') {
    if (navUsuarios) navUsuarios.style.display = 'none';
    if (navModeracao) navModeracao.style.display = 'none';
  } else {
    if (navUsuarios) navUsuarios.style.display = 'flex';
    if (navModeracao) navModeracao.style.display = 'flex';
    window.updateModeracaoNavBadge?.();
  }
  if (user?.acesso === 'Gestor') {
    if (navPendGestor) navPendGestor.style.display = 'flex';
    window.updateGestorPendenciasNavBadge?.();
  } else if (navPendGestor) {
    navPendGestor.style.display = 'none';
  }

  navigate('dashboard');
}

function exitApp() {
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  const cpf = document.getElementById('login-cpf');
  const senha = document.getElementById('login-senha');
  if (cpf) cpf.value = '';
  if (senha) senha.value = '';
}

// Wrappers que casam `enterApp`/`exitApp` aos forms do HTML (templates chamam
// `doLogin()` / `doLogout()` sem argumentos via inline handler).
window.doLogin = () => doLoginImpl({ onSuccess: enterApp });
window.doRegister = () => doRegisterImpl();
window.doLogout = () => doLogoutImpl({ onLogout: exitApp });

async function boot() {
  let restored = false;
  try {
    restored = await restoreSession();
  } catch (err) {
    console.error('[ESPEN] restoreSession threw:', err);
  }

  if (restored) {
    enterApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSidebar();
      document.getElementById('modal-overlay')?.classList.remove('active');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM já está pronto — chama imediatamente (race com módulos deferidos).
  boot();
}
