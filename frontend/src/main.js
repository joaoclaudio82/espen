/**
 * Entrypoint do bundle Vite.
 *
 * Imports estáticos no topo:
 *   - estilos (CSS extraído do monólito anterior, byte-a-byte)
 *   - libs externas que precisam estar em `window` para o legacy.js
 *   - módulos novos (api/auth/shared)
 *   - legacy.js — registra renderers e helpers em globalThis
 *
 * O bootstrap fica em `boot()` chamado no DOMContentLoaded; nenhum await
 * top-level para evitar que falhas no carregamento impeçam o registro do listener.
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

import {
  doLogin as doLoginImpl,
  doLogout as doLogoutImpl,
  doRegister as doRegisterImpl,
  getCurrentUser,
  restoreSession,
  showForgotPassword,
  switchAuthTab,
  updateSidebarUser,
  validateRegisterCPF,
} from './auth/session.js';
import { maskCPF } from './auth/cpf.js';

// Vite empacota libs CJS de forma inconsistente: às vezes os símbolos vêm
// direto no namespace, outras ficam atrás de `.default`. Normalizamos para
// que o legacy.js acesse `window.XLSX.read(...)`/`window.docx.Document` como no UMD original.
const XLSX = xlsxNs && typeof xlsxNs.read === 'function' ? xlsxNs : (xlsxNs.default || xlsxNs);
const docx = docxNs && docxNs.Document ? docxNs : (docxNs.default || docxNs);

Chart.register(...registerables);
window.Chart = Chart;
window.docx = docx;
window.PizZip = PizZip;
window.saveAs = saveAs;
window.XLSX = XLSX;

// Import estático: legacy.js executa no momento do parse do módulo, registrando
// suas ~50 funções em globalThis via o footer `Object.assign(globalThis, {...})`.
//
// Páginas extraídas — cada módulo registra seu(s) renderer(s) em globalThis.
// (Importadas ANTES de legacy.js para que o `Object.assign(globalThis,…)` no
// rodapé do legacy não tente reexportar funções que não existem mais lá.)
import './pages/sobre.js';
import './pages/configuracoes.js';
import './pages/usuarios.js';
import './pages/trilhas.js';
import './pages/dashboard.js';
import './pages/matriz.js';

import './legacy.js';

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

  window.navigate?.('dashboard');
}

function exitApp() {
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  const cpf = document.getElementById('login-cpf');
  const senha = document.getElementById('login-senha');
  if (cpf) cpf.value = '';
  if (senha) senha.value = '';
}

window.doLogin = () => doLoginImpl({ onSuccess: enterApp });
window.doRegister = () => doRegisterImpl();
window.doLogout = () => doLogoutImpl({ onLogout: exitApp });
window.showForgotPassword = showForgotPassword;
window.switchAuthTab = switchAuthTab;
window.validateRegisterCPF = validateRegisterCPF;
window.maskCPF = maskCPF;

async function boot() {
  console.log('[ESPEN] boot start');
  let restored = false;
  try {
    restored = await restoreSession();
    console.log('[ESPEN] restoreSession =', restored);
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
      window.closeSidebar?.();
      document.getElementById('modal-overlay')?.classList.remove('active');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM já está pronto — chama imediatamente (fallback para race com módulos deferidos).
  boot();
}
