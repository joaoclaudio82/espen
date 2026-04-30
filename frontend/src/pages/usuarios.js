/**
 * Página "Gestão de Usuários" — listagem, cadastro/edição (modal),
 * ativação/desativação. Acesso restrito a administradores.
 */
import { apiFetch } from '../api/client.js';
import { STORAGE_KEYS, getStorage, invalidateUsersCache } from '../api/storage.js';
import { validateCPF } from '../auth/cpf.js';
import { sha256HexUtf8 } from '../auth/crypto.js';
import { getCurrentUser } from '../auth/session.js';
import { closeModalBtn, openModal } from '../router.js';
import { showToast } from '../shared/toast.js';

export function renderUsuarios() {
  const currentUser = getCurrentUser();
  if (currentUser.acesso !== 'Administrador') {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h3>Acesso Restrito</h3><p>Apenas administradores podem acessar esta área.</p></div>`;
    return;
  }
  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-gold btn-sm" onclick="openUserForm()"><i class="fas fa-user-plus"></i> <span class="btn-label">Novo Usuário</span></button>
  `;
  const users = getStorage(STORAGE_KEYS.users) || [];
  const acessoColors = { Administrador: 'blue', Gestor: 'gold', Usuário: 'green', usuário: 'green', Visitante: 'gray' };

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Gestão de Usuários</div>
        <div class="section-sub">${users.length} usuários cadastrados no sistema</div>
      </div>
    </div>
    <div class="table-card">
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th class="hide-mobile">CPF</th>
              <th class="hide-mobile">E-mail</th>
              <th class="hide-mobile">Cargo</th>
              <th>Acesso</th>
              <th class="hide-mobile">Cadastro</th>
              <th>Status</th>
              <th style="width:90px;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const ac = u.acesso || 'Usuário';
              const cc = acessoColors[ac] || 'gray';
              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div class="user-avatar" style="width:32px;height:32px;font-size:11px;flex-shrink:0;">${u.nome.substring(0,2).toUpperCase()}</div>
                      <div>
                        <div class="fw-600" style="font-size:13px;">${u.nome}</div>
                        <div style="font-size:11px;color:var(--gray-500);display:none;" class="hide-desktop">${u.cpf}</div>
                      </div>
                    </div>
                  </td>
                  <td class="hide-mobile" style="font-size:12px;">${u.cpf}</td>
                  <td class="hide-mobile" style="font-size:12px;">${u.email}</td>
                  <td class="hide-mobile" style="font-size:12px;max-width:180px;" title="${u.cargo||'—'}">${(u.cargo||'—').substring(0,30)}${u.cargo&&u.cargo.length>30?'…':''}</td>
                  <td><span class="badge badge-${cc}">${ac}</span></td>
                  <td class="hide-mobile" style="font-size:12px;">${u.data_registro ? new Date(u.data_registro).toLocaleDateString('pt-BR') : '—'}</td>
                  <td><span class="badge badge-${u.ativo!==false?'green':'red'}">${u.ativo!==false?'Ativo':'Pendente ou inativo'}</span></td>
                  <td>
                    <div style="display:flex;gap:4px;">
                      <button class="btn btn-secondary btn-sm" onclick="editUser('${u.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                      ${u.id !== currentUser.id ? `<button class="btn ${u.ativo!==false?'btn-danger':'btn-success'} btn-sm" onclick="toggleUser('${u.id}')" title="${u.ativo!==false?'Desativar':'Ativar'}"><i class="fas fa-${u.ativo!==false?'ban':'check'}"></i></button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function openUserForm(id = null) {
  const users = getStorage(STORAGE_KEYS.users) || [];
  const u = id ? (users.find(x => x.id === id) || {}) : {};
  const body = `
    <div class="form-grid">
      <div class="form-group"><label>CPF *</label><input type="text" id="uf-cpf" value="${u.cpf||''}" maxlength="14" oninput="maskCPF(this)" ${id?'readonly':''}></div>
      <div class="form-group"><label>Nome Completo *</label><input type="text" id="uf-nome" value="${u.nome||''}"></div>
      <div class="form-group"><label>E-mail *</label><input type="email" id="uf-email" value="${u.email||''}"></div>
      <div class="form-group">
        <label>Cargo</label>
        <select id="uf-cargo">
          <option value="">Selecione...</option>
          ${['Policial Penal','Especialista Federal em Assistência à Execução Penal','Técnico Federal de Apoio à Execução Penal','Docente','Outro'].map(c=>`<option value="${c}" ${u.cargo===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Nível de Acesso</label>
        <select id="uf-acesso">
          ${['Usuário','Gestor','Administrador'].map(a=>`<option value="${a}" ${(u.acesso||'Usuário')===a?'selected':''}>${a}</option>`).join('')}
        </select>
      </div>
      ${!id ? `
        <div class="form-group"><label>Senha *</label><input type="password" id="uf-senha" placeholder="Mín. 6 caracteres"></div>
        <div class="form-group"><label>Confirmar Senha *</label><input type="password" id="uf-confirma"></div>
      ` : '<div class="form-group"><label>Nova Senha (deixe em branco para manter)</label><input type="password" id="uf-senha" placeholder="Nova senha..."></div>'}
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button class="btn btn-primary" onclick="void saveUser();"><i class="fas fa-save"></i> ${id?'Salvar':'Cadastrar'}</button>
  `;
  openModal(id ? 'Editar Usuário' : 'Novo Usuário', `<input type="hidden" id="uf-row-id" value="${id||''}">${body}`, footer, false);
}

export function editUser(id) { openUserForm(id); }

export async function saveUser() {
  const id = (document.getElementById('uf-row-id') && document.getElementById('uf-row-id').value) || '';
  const cpf = document.getElementById('uf-cpf').value.trim();
  const nome = document.getElementById('uf-nome').value.trim();
  const email = document.getElementById('uf-email').value.trim();
  const cargo = document.getElementById('uf-cargo').value;
  const niveis = ['Usuário', 'Gestor', 'Administrador'];
  let acesso = (document.getElementById('uf-acesso') && document.getElementById('uf-acesso').value || '').trim();
  if (!niveis.includes(acesso)) acesso = 'Usuário';
  const senha = document.getElementById('uf-senha').value;

  if (!cpf || !nome || !email) { showToast('Preencha os campos obrigatórios', 'warning'); return; }
  if (!id && !senha) { showToast('Informe a senha', 'warning'); return; }
  if (!id) {
    const confirma = document.getElementById('uf-confirma').value;
    if (senha !== confirma) { showToast('As senhas não coincidem', 'error'); return; }
    if (!validateCPF(cpf)) { showToast('CPF inválido', 'error'); return; }
  }

  try {
    if (id) {
      const body = { nome, email, cargo, acesso };
      if (senha) body.senha = await sha256HexUtf8(senha);
      await apiFetch('PUT', `/users/${id}`, body);
    } else {
      const senhaWire = await sha256HexUtf8(senha);
      await apiFetch('POST', '/users', { cpf, nome, email, cargo, acesso, senha: senhaWire });
    }
    await invalidateUsersCache();
    closeModalBtn();
    showToast(id ? 'Usuário atualizado!' : 'Usuário cadastrado!', 'success');
    renderUsuarios();
  } catch (err) {
    showToast(err.message || 'Erro ao salvar usuário', 'error');
  }
}

export async function toggleUser(id) {
  try {
    const updated = await apiFetch('PATCH', `/users/${id}/toggle`);
    await invalidateUsersCache();
    showToast(`Usuário ${updated.ativo ? 'ativado' : 'desativado'}.`, 'success');
    renderUsuarios();
  } catch (err) {
    showToast(err.message || 'Erro ao alterar status do usuário', 'error');
  }
}

Object.assign(globalThis, { renderUsuarios, openUserForm, editUser, saveUser, toggleUser });
