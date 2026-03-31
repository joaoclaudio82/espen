/**
 * ESPEN – js/auth.js
 * Autenticação: registro, login, sessão JWT-like, recuperação de senha.
 * Todas as senhas são hashed via djb2 (simples, client-side).
 */

/* ── Chaves localStorage ─────────────────────────────────────── */
const LS_USERS   = 'espen_users';
const LS_TOKEN   = 'espen_token';
const LS_SESSION = 'espen_session';

/* ── Hash simples (djb2) ─────────────────────────────────────── */
function hashPassword(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

/* ── Gera token JWT-like ─────────────────────────────────────── */
function generateToken(user) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: user.id,
    name: user.nome,
    acesso: user.acesso,
    iat: Date.now(),
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8 horas
  }));
  const sig = btoa(hashPassword(header + '.' + payload));
  return `${header}.${payload}.${sig}`;
}

/* ── Lê/valida token ─────────────────────────────────────────── */
function parseToken(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  if (!token) return false;
  const data = parseToken(token);
  if (!data) return false;
  return data.exp > Date.now();
}

/* ── CRUD de usuários (localStorage) ────────────────────────── */
function getUsers() {
  return JSON.parse(localStorage.getItem(LS_USERS) || '[]');
}

function saveUsers(users) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function getUserById(id) {
  return getUsers().find(u => u.id === id) || null;
}

function getUserByCpf(cpf) {
  const cleaned = cpf.replace(/\D/g, '');
  return getUsers().find(u => u.cpf.replace(/\D/g, '') === cleaned) || null;
}

/* ── Seed admin ──────────────────────────────────────────────── */
function seedAdmin() {
  const users = getUsers();
  const adminCpf = '72792736968';
  if (!users.find(u => u.cpf.replace(/\D/g, '') === adminCpf)) {
    users.push({
      id: 'user-admin-001',
      nome: 'Reginaldo Manoel Teixeira',
      cpf: '727.927.369-68',
      email: 'regisfsc@gmail.com',
      cargo: 'Docente UFSC',
      acesso: 'Administrador',
      senha: hashPassword('admin123'),
      ativo: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    saveUsers(users);
  }
}

/* ── Sessão atual ────────────────────────────────────────────── */
function getCurrentUser() {
  const token = localStorage.getItem(LS_TOKEN);
  if (!isTokenValid(token)) return null;
  const data = parseToken(token);
  return getUserById(data.sub);
}

function setSession(user) {
  const token = generateToken(user);
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_SESSION, JSON.stringify({
    id: user.id,
    nome: user.nome,
    email: user.email,
    cargo: user.cargo,
    acesso: user.acesso,
  }));
}

function clearSession() {
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_SESSION);
}

/* ── Validação de CPF ────────────────────────────────────────── */
function validateCpf(cpf) {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(n[i - 1]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(n[9])) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(n[i - 1]) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(n[10]);
}

/* ── Máscara de CPF ──────────────────────────────────────────── */
function maskCpf(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  input.value = v;
}

/* ── LOGIN ───────────────────────────────────────────────────── */
function handleLogin(e) {
  e.preventDefault();
  const cpfInput = document.getElementById('login-cpf');
  const senhaInput = document.getElementById('login-senha');
  const cpf = cpfInput.value.trim();
  const senha = senhaInput.value;

  // Reset
  cpfInput.classList.remove('is-invalid');
  senhaInput.classList.remove('is-invalid');

  if (!cpf) { cpfInput.classList.add('is-invalid'); showToast('Informe o CPF.', 'danger'); return; }
  if (!senha) { senhaInput.classList.add('is-invalid'); showToast('Informe a senha.', 'danger'); return; }

  const user = getUserByCpf(cpf);
  if (!user) { cpfInput.classList.add('is-invalid'); showToast('CPF não cadastrado.', 'danger'); return; }
  if (!user.ativo) { showToast('Usuário inativo. Contate o administrador.', 'warning'); return; }
  if (user.senha !== hashPassword(senha)) { senhaInput.classList.add('is-invalid'); showToast('Senha incorreta.', 'danger'); return; }

  setSession(user);
  logActivity('login', `<strong>${user.nome}</strong> fez login no sistema.`);
  showToast(`Bem-vindo(a), ${user.nome.split(' ')[0]}!`, 'success');
  enterApp();
}

/* ── REGISTRO ────────────────────────────────────────────────── */
function handleRegister(e) {
  e.preventDefault();
  const fields = {
    nome:    document.getElementById('reg-nome'),
    cpf:     document.getElementById('reg-cpf'),
    email:   document.getElementById('reg-email'),
    cargo:   document.getElementById('reg-cargo'),
    senha:   document.getElementById('reg-senha'),
    confirm: document.getElementById('reg-confirm'),
    acesso:  document.getElementById('reg-acesso'),
  };

  let valid = true;
  Object.values(fields).forEach(f => f.classList.remove('is-invalid'));

  const nome  = fields.nome.value.trim();
  const cpf   = fields.cpf.value.trim();
  const email = fields.email.value.trim();
  const cargo = fields.cargo.value;
  const senha = fields.senha.value;
  const confirm = fields.confirm.value;
  const acesso  = fields.acesso.value;

  if (!nome || nome.length < 5) { fields.nome.classList.add('is-invalid'); valid = false; }
  if (!validateCpf(cpf)) { fields.cpf.classList.add('is-invalid'); valid = false; }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fields.email.classList.add('is-invalid'); valid = false; }
  if (!cargo) { fields.cargo.classList.add('is-invalid'); valid = false; }
  if (!acesso) { fields.acesso.classList.add('is-invalid'); valid = false; }
  if (!senha || senha.length < 6) { fields.senha.classList.add('is-invalid'); valid = false; }
  if (senha !== confirm) { fields.confirm.classList.add('is-invalid'); valid = false; }

  if (!valid) { showToast('Corrija os campos destacados.', 'danger'); return; }

  if (getUserByCpf(cpf)) { fields.cpf.classList.add('is-invalid'); showToast('CPF já cadastrado.', 'danger'); return; }

  const users = getUsers();
  const newUser = {
    id: 'user-' + Date.now(),
    nome, cpf, email, cargo, acesso,
    senha: hashPassword(senha),
    ativo: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  users.push(newUser);
  saveUsers(users);
  logActivity('create', `Novo usuário <strong>${nome}</strong> cadastrado.`);
  showToast('Cadastro realizado! Faça login.', 'success');
  switchAuthTab('login');
  document.getElementById('register-form').reset();
}

/* ── RECUPERAR SENHA ─────────────────────────────────────────── */
function handleForgotPassword() {
  const cpf = prompt('Informe seu CPF cadastrado (apenas números):');
  if (!cpf) return;
  const user = getUserByCpf(cpf);
  if (!user) { showToast('CPF não encontrado no sistema.', 'danger'); return; }
  const novaSenha = prompt(`Usuário encontrado: ${user.nome}\nDigite a nova senha (mínimo 6 caracteres):`);
  if (!novaSenha || novaSenha.length < 6) { showToast('Senha muito curta. Mínimo 6 caracteres.', 'danger'); return; }
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  users[idx].senha = hashPassword(novaSenha);
  users[idx].updatedAt = Date.now();
  saveUsers(users);
  showToast('Senha redefinida com sucesso! Faça login.', 'success');
}

/* ── LOGOUT ──────────────────────────────────────────────────── */
function handleLogout() {
  const user = getCurrentUser();
  if (user) logActivity('login', `<strong>${user.nome}</strong> saiu do sistema.`);
  clearSession();
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('bottom-nav').style.display = 'none';
  showToast('Sessão encerrada.', 'info');
}

/* ── Troca de aba (Login / Cadastro) ────────────────────────── */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
  const btn = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
  const panel = document.getElementById(`panel-${tab}`);
  if (btn)   btn.classList.add('active');
  if (panel) panel.classList.add('active');
}

/* ── Toggle visibilidade senha ───────────────────────────────── */
function togglePasswordVisibility(iconEl) {
  const input = iconEl.previousElementSibling || iconEl.parentElement.querySelector('input');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    iconEl.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    iconEl.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

/* ── Init auth events ────────────────────────────────────────── */
function initAuth() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Register form
  const regForm = document.getElementById('register-form');
  if (regForm) regForm.addEventListener('submit', handleRegister);

  // CPF masks
  document.querySelectorAll('.cpf-mask').forEach(input => {
    input.addEventListener('input', () => maskCpf(input));
  });

  // Password toggles
  document.querySelectorAll('.input-icon.toggle-pass').forEach(icon => {
    icon.addEventListener('click', () => togglePasswordVisibility(icon));
  });

  // Forgot password link
  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) forgotLink.addEventListener('click', handleForgotPassword);

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const logoutNav = document.getElementById('nav-logout');
  if (logoutNav) logoutNav.addEventListener('click', handleLogout);
}
