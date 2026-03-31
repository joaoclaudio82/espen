/**
 * ESPEN – js/usuarios.js
 * Gestão de usuários (admin only): listagem, edição, ativação/desativação.
 */

let usuariosState = { data: [], filtered: [], page: 1, pageSize: 15, search: '', editId: null };

const acessoColors = {
  Administrador: 'badge-danger',
  Gestor:        'badge-navy',
  Servidor:      'badge-success',
  Visitante:     'badge-gray',
};

/* ── Render ──────────────────────────────────────────────────── */
function renderUsuarios() {
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-primary btn-sm" onclick="openUserForm()">
      <i class="fas fa-user-plus"></i> <span class="btn-label">Novo Usuário</span>
    </button>`;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Gestão de Usuários</h2>
        <p>Controle de acesso e perfis do sistema ESPEN</p>
      </div>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="usr-search" placeholder="Buscar por nome, CPF ou e-mail…" oninput="usuariosFilter()">
        </div>
      </div>
      <div class="table-scroll desktop-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th class="hide-mobile">CPF</th>
              <th class="hide-mobile">E-mail</th>
              <th class="hide-mobile">Cargo</th>
              <th>Acesso</th>
              <th class="hide-mobile">Cadastro</th>
              <th>Status</th>
              <th style="width:100px">Ações</th>
            </tr>
          </thead>
          <tbody id="usr-tbody"></tbody>
        </table>
      </div>
      <div class="mobile-cards" id="usr-mobile-cards"></div>
      <div class="table-footer">
        <div class="table-info" id="usr-info"></div>
        <div class="pagination" id="usr-pagination"></div>
      </div>
    </div>
    <!-- Modal -->
    <div class="modal-overlay" id="usr-modal" onclick="if(event.target===this) closeModal('usr-modal')">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3 id="usr-modal-title">Usuário</h3>
          <button class="modal-close" onclick="closeModal('usr-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="usr-modal-body"></div>
        <div class="modal-footer" id="usr-modal-footer"></div>
      </div>
    </div>`;

  usuariosLoad();
}

function usuariosLoad() {
  usuariosState.data     = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  usuariosState.filtered = [...usuariosState.data];
  usuariosState.page     = 1;
  usuariosRender();
}

function usuariosFilter() {
  const search = document.getElementById('usr-search')?.value.toLowerCase() || '';
  usuariosState.filtered = usuariosState.data.filter(u => {
    if (!search) return true;
    return (u.nome + u.cpf + u.email + u.cargo).toLowerCase().includes(search);
  });
  usuariosState.page = 1;
  usuariosRender();
}

function usuariosRender() {
  const { filtered, page, pageSize } = usuariosState;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  const tbody = document.getElementById('usr-tbody');
  if (tbody) {
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="8">
        <div class="empty-state"><i class="fas fa-users"></i><h3>Nenhum usuário encontrado</h3></div>
      </td></tr>`;
    } else {
      tbody.innerHTML = slice.map(u => {
        const initials = u.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
        const isSelf   = u.id === currentUser?.id;
        return `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <div class="user-avatar" style="width:32px;height:32px;font-size:12px;">${initials}</div>
                <div>
                  <div style="font-weight:600;font-size:13px;">${truncate(u.nome, 28)}</div>
                  ${isSelf ? '<span style="font-size:10px;color:var(--navy);">(você)</span>' : ''}
                </div>
              </div>
            </td>
            <td class="hide-mobile"><span style="font-size:12px;">${u.cpf}</span></td>
            <td class="hide-mobile"><span style="font-size:12px;">${truncate(u.email, 28)}</span></td>
            <td class="hide-mobile"><span style="font-size:12px;">${truncate(u.cargo, 30)}</span></td>
            <td><span class="badge ${acessoColors[u.acesso] || 'badge-gray'}">${u.acesso}</span></td>
            <td class="hide-mobile"><span style="font-size:12px;">${formatDate(u.createdAt)}</span></td>
            <td>
              <span class="badge ${u.ativo ? 'badge-success' : 'badge-danger'}">
                ${u.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </td>
            <td>
              <div style="display:flex;gap:4px;">
                <button class="btn-icon btn-sm" title="Editar" onclick="openUserForm('${u.id}')">
                  <i class="fas fa-edit"></i>
                </button>
                ${!isSelf ? `
                <button class="btn-icon btn-sm ${u.ativo ? 'danger' : ''}" title="${u.ativo ? 'Desativar' : 'Ativar'}"
                  onclick="toggleUser('${u.id}')">
                  <i class="fas fa-${u.ativo ? 'user-slash' : 'user-check'}"></i>
                </button>` : ''}
              </div>
            </td>
          </tr>`;
      }).join('');
    }
  }

  const mobileCards = document.getElementById('usr-mobile-cards');
  if (mobileCards) {
    mobileCards.innerHTML = slice.map(u => {
      const initials = u.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
      return `
        <div class="activity-item" style="padding:12px 16px;">
          <div class="user-avatar" style="width:38px;height:38px;">${initials}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">${u.nome}</div>
            <div style="font-size:11px;color:var(--gray-500);">${u.cargo}</div>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <span class="badge ${acessoColors[u.acesso] || 'badge-gray'}">${u.acesso}</span>
              <span class="badge ${u.ativo ? 'badge-success' : 'badge-danger'}">${u.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button class="btn-icon btn-sm" onclick="openUserForm('${u.id}')"><i class="fas fa-edit"></i></button>
          </div>
        </div>`;
    }).join('') || `<div class="empty-state"><i class="fas fa-users"></i><p>Nenhum usuário encontrado</p></div>`;
  }

  const info = document.getElementById('usr-info');
  if (info) {
    const ativos = filtered.filter(u => u.ativo).length;
    info.textContent = `${total} usuários (${ativos} ativos)`;
  }

  const pag = document.getElementById('usr-pagination');
  if (pag) pag.innerHTML = buildPagination(page, Math.ceil(total / pageSize), 'usuariosGoPage');
}

function usuariosGoPage(p) {
  usuariosState.page = p;
  usuariosRender();
}

/* ── Ativar/Desativar ────────────────────────────────────────── */
function toggleUser(id) {
  const users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  const u = users.find(x => x.id === id);
  if (!u) return;
  if (!confirm(`${u.ativo ? 'Desativar' : 'Ativar'} o usuário "${u.nome}"?`)) return;
  u.ativo = !u.ativo;
  u.updatedAt = Date.now();
  localStorage.setItem(LS_USERS, JSON.stringify(users));
  logActivity('update', `Usuário <strong>${u.nome}</strong> ${u.ativo ? 'ativado' : 'desativado'}.`);
  showToast(`Usuário ${u.ativo ? 'ativado' : 'desativado'}.`, 'success');
  usuariosLoad();
}

/* ── Formulário edição ───────────────────────────────────────── */
function openUserForm(id = null) {
  usuariosState.editId = id;
  const u = id ? usuariosState.data.find(x => x.id === id) : null;
  const d = window.ESPEN_DATA || {};
  const sel = (arr, val) => arr.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');

  document.getElementById('usr-modal-title').textContent = id ? 'Editar Usuário' : 'Novo Usuário';
  document.getElementById('usr-modal-body').innerHTML = `
    <form id="usr-form">
      <div class="form-group">
        <label>Nome Completo *</label>
        <input class="form-control" id="uf-nome" required value="${u?.nome || ''}">
      </div>
      <div class="form-group">
        <label>CPF *</label>
        <input class="form-control cpf-mask" id="uf-cpf" required value="${u?.cpf || ''}" ${id ? 'readonly style="background:var(--gray-100)"' : ''}>
      </div>
      <div class="form-group">
        <label>E-mail *</label>
        <input type="email" class="form-control" id="uf-email" required value="${u?.email || ''}">
      </div>
      <div class="form-group">
        <label>Cargo *</label>
        <input class="form-control" id="uf-cargo" required value="${u?.cargo || ''}">
      </div>
      <div class="form-group">
        <label>Nível de Acesso *</label>
        <select class="form-control" id="uf-acesso" required>
          <option value="">Selecione</option>
          ${sel(d.NIVEIS_ACESSO || [], u?.acesso)}
        </select>
      </div>
      ${!id ? `
      <div class="form-group">
        <label>Senha (mín. 6 caracteres) *</label>
        <input type="password" class="form-control" id="uf-senha" required minlength="6">
      </div>` : ''}
    </form>`;

  document.getElementById('usr-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('usr-modal')">Cancelar</button>
    <button class="btn btn-primary" onclick="saveUser()">
      <i class="fas fa-save"></i> Salvar
    </button>`;

  // Apply CPF mask
  const cpfInput = document.getElementById('uf-cpf');
  if (cpfInput && !id) cpfInput.addEventListener('input', () => maskCpf(cpfInput));

  openModal('usr-modal');
}

function saveUser() {
  const nome   = document.getElementById('uf-nome')?.value.trim();
  const cpf    = document.getElementById('uf-cpf')?.value.trim();
  const email  = document.getElementById('uf-email')?.value.trim();
  const cargo  = document.getElementById('uf-cargo')?.value.trim();
  const acesso = document.getElementById('uf-acesso')?.value;
  const senha  = document.getElementById('uf-senha')?.value;

  if (!nome || !email || !cargo || !acesso) { showToast('Preencha todos os campos obrigatórios.', 'danger'); return; }

  const users = JSON.parse(localStorage.getItem(LS_USERS) || '[]');

  if (usuariosState.editId) {
    const idx = users.findIndex(u => u.id === usuariosState.editId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], nome, email, cargo, acesso, updatedAt: Date.now() };
    }
    logActivity('update', `Usuário <strong>${nome}</strong> atualizado.`);
    showToast('Usuário atualizado!', 'success');
  } else {
    if (!cpf || !validateCpf(cpf)) { showToast('CPF inválido.', 'danger'); return; }
    if (getUserByCpf(cpf)) { showToast('CPF já cadastrado.', 'danger'); return; }
    if (!senha || senha.length < 6) { showToast('Senha deve ter no mínimo 6 caracteres.', 'danger'); return; }
    users.push({
      id: generateId('user'), nome, cpf, email, cargo, acesso,
      senha: hashPassword(senha), ativo: true,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    logActivity('create', `Usuário <strong>${nome}</strong> criado pelo admin.`);
    showToast('Usuário criado!', 'success');
  }

  localStorage.setItem(LS_USERS, JSON.stringify(users));
  closeModal('usr-modal');
  usuariosLoad();
}
