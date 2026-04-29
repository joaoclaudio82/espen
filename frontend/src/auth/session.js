/**
 * Login, registro e ciclo de sessão.
 *
 * - O cliente envia SHA-256 hex da senha; o backend mantém um caminho de migração
 *   transparente para hashes legados.
 * - Em ambiente local (`isLocalDevApiHost()`) ainda aceita re-tentar com a senha em
 *   texto plano se o servidor responder 401 (instalações antigas).
 */
import { apiFetch, clearToken, isLocalDevApiHost, setToken } from '../api/client.js';
import {
  STORAGE_KEYS,
  clearAllCache,
  prefetchAll,
  setStorage,
} from '../api/storage.js';
import { showToast } from '../shared/toast.js';
import { escapeHtmlStr } from '../shared/escape.js';
import { sha256HexUtf8 } from './crypto.js';
import { validateCPF } from './cpf.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
}

export function validateRegisterCPF(skipIncomplete = false) {
  const cpfInput = document.getElementById('reg-cpf');
  const feedback = document.getElementById('reg-cpf-feedback');
  if (!cpfInput || !feedback) return true;

  const cpf = (cpfInput.value || '').trim();
  const digits = cpf.replace(/\D/g, '');

  cpfInput.style.borderColor = '';
  feedback.style.display = 'none';
  feedback.textContent = '';

  if (digits.length === 0) return true;
  if (digits.length < 11) {
    if (!skipIncomplete) {
      feedback.style.display = 'block';
      feedback.style.color = 'var(--warning)';
      feedback.textContent = 'CPF incompleto.';
      cpfInput.style.borderColor = 'var(--warning)';
    }
    return false;
  }

  const isValid = validateCPF(cpf);
  feedback.style.display = 'block';
  feedback.style.color = isValid ? 'var(--success)' : 'var(--danger)';
  feedback.textContent = isValid ? 'CPF válido.' : 'CPF inválido. Verifique os dígitos.';
  cpfInput.style.borderColor = isValid ? 'var(--success)' : 'var(--danger)';
  return isValid;
}

export function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((el, idx) => {
    el.classList.toggle('active', (idx === 0 && tab === 'login') || (idx === 1 && tab === 'register'));
  });
  document.getElementById('login-form').classList.toggle('active', tab === 'login');
  document.getElementById('register-form').classList.toggle('active', tab === 'register');
}

export function showForgotPassword() {
  showToast('Para redefinir sua senha, contate o administrador do sistema.', 'info');
}

function applyLoginResponse(response) {
  setToken(response.access_token);
  currentUser = response.user;
  setStorage(STORAGE_KEYS.session, {
    userId: response.user.id,
    cpf: response.user.cpf,
    loginTime: Date.now(),
  });
  // `prefetchAll()` é chamado pelos callers logo em seguida e já popula `users`.
}

export async function doLogin({ onSuccess } = {}) {
  const cpf = document.getElementById('login-cpf').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!cpf || !senha) return showToast('Preencha CPF e senha', 'warning');
  if (!validateCPF(cpf)) return showToast('CPF inválido. Verifique os dígitos.', 'error');

  const senhaWire = await sha256HexUtf8(senha);
  try {
    const response = await apiFetch('POST', '/auth/login', { cpf, senha: senhaWire }, { useAuth: false });
    applyLoginResponse(response);
    await prefetchAll();
    onSuccess?.();
    return;
  } catch (err) {
    if (err.status === 401 && isLocalDevApiHost()) {
      try {
        const response = await apiFetch('POST', '/auth/login', { cpf, senha }, { useAuth: false });
        applyLoginResponse(response);
        await prefetchAll();
        console.warn('[ESPEN] Login com senha em texto plano (fallback só em API local); o servidor migra o hash.');
        onSuccess?.();
        return;
      } catch (err2) {
        showToast(err2.message || 'CPF ou senha inválidos', 'error');
        return;
      }
    }
    showToast(err.message || 'CPF ou senha inválidos', 'error');
  }
}

export async function doRegister() {
  const cpf = document.getElementById('reg-cpf').value.trim();
  const nome = document.getElementById('reg-nome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const cargo = document.getElementById('reg-cargo').value;
  const senha = document.getElementById('reg-senha').value;
  const confirma = document.getElementById('reg-confirma').value;

  if (!cpf || !nome || !email || !senha || !confirma) {
    return showToast('Preencha todos os campos obrigatórios (*)', 'warning');
  }
  if (!cargo) return showToast('Selecione o cargo', 'warning');
  if (!validateRegisterCPF()) return showToast('CPF inválido', 'error');
  if (senha.length < 6) return showToast('Senha deve ter no mínimo 6 caracteres', 'warning');
  if (senha !== confirma) return showToast('As senhas não coincidem', 'error');

  try {
    const senhaWire = await sha256HexUtf8(senha);
    await apiFetch(
      'POST',
      '/auth/register',
      { cpf, nome, email, cargo, acesso: 'Usuário', senha: senhaWire },
      { useAuth: false },
    );
    showToast(
      'Cadastro recebido. Quando um administrador aprovar sua conta, você poderá entrar no sistema.',
      'success',
    );
    switchAuthTab('login');
    document.getElementById('login-cpf').value = cpf;
  } catch (err) {
    showToast(err.message || 'Erro ao criar conta', 'error');
  }
}

export async function restoreSession() {
  const session = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.session)) || null;
    } catch {
      return null;
    }
  })();
  if (!session) return false;
  try {
    currentUser = await apiFetch('GET', '/auth/me');
    if (!currentUser) return false;
    await prefetchAll();
    return true;
  } catch (err) {
    // Token expirado / DB reiniciada / chave JWT trocada → limpa o estado obsoleto
    // para que o próximo reload caia direto na tela de login em vez de re-tentar.
    console.warn('Sessão inválida — limpando token obsoleto:', err.message);
    localStorage.removeItem(STORAGE_KEYS.session);
    clearToken();
    clearAllCache();
    currentUser = null;
    return false;
  }
}

export function doLogout({ onLogout } = {}) {
  if (!confirm('Deseja realmente sair do sistema?')) return;
  localStorage.removeItem(STORAGE_KEYS.session);
  clearToken();
  clearAllCache();
  currentUser = null;
  onLogout?.();
}

export function updateSidebarUser() {
  if (!currentUser) return;
  const wrap = document.getElementById('sidebar-user-preview');
  if (!wrap) return;
  const nome = (currentUser.nome || '').trim() || 'Usuário';
  const iniciais = nome.substring(0, 2).toUpperCase();
  const email = (currentUser.email || '').trim() || '—';
  const cpf = (currentUser.cpf || '').trim() || '—';
  const ac = currentUser.acesso || 'Usuário';
  const acessoColors = {
    Administrador: 'blue',
    Gestor: 'gold',
    Usuário: 'green',
    'usuário': 'green',
    Visitante: 'gray',
  };
  const cc = acessoColors[ac] || 'gray';
  wrap.innerHTML = `
    <div class="sidebar-user-preview-inner">
      <div class="sidebar-preview-avatar" aria-hidden="true">${escapeHtmlStr(iniciais)}</div>
      <div class="sidebar-preview-meta">
        <div class="sidebar-preview-name">${escapeHtmlStr(nome)}</div>
        <div class="sidebar-preview-line"><span class="badge badge-${cc}">${escapeHtmlStr(ac)}</span></div>
        <div class="sidebar-preview-detail">${escapeHtmlStr(email)}</div>
        <div class="sidebar-preview-detail">${escapeHtmlStr(cpf)}</div>
      </div>
    </div>
  `;
}
