/**
 * Página "Configurações" — perfil do usuário, contadores do sistema,
 * troca de senha e reinicialização (admin).
 */
import { apiFetch } from '../api/client.js';
import { STORAGE_KEYS, deleteStorage, getStorage } from '../api/storage.js';
import { sha256HexUtf8 } from '../auth/crypto.js';
import { getCurrentUser } from '../auth/session.js';
import { closeModalBtn, openModal } from '../router.js';
import { showToast } from '../shared/toast.js';

export function renderConfiguracoes() {
  const currentUser = getCurrentUser();
  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div><div class="section-title">Configurações</div><div class="section-sub">Gerencie as configurações do sistema</div></div>
    </div>
    <div class="config-grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-user" style="color:var(--navy);margin-right:8px;"></i>Meu Perfil</h3></div>
        <div class="card-body">
          <div class="detail-field"><div class="detail-label">Nome</div><div class="detail-value fw-600">${currentUser.nome}</div></div>
          <div class="detail-field"><div class="detail-label">CPF</div><div class="detail-value">${currentUser.cpf}</div></div>
          <div class="detail-field"><div class="detail-label">E-mail</div><div class="detail-value">${currentUser.email}</div></div>
          <div class="detail-field"><div class="detail-label">Cargo</div><div class="detail-value">${currentUser.cargo||'—'}</div></div>
          <div class="detail-field"><div class="detail-label">Nível de Acesso</div><div class="detail-value"><span class="badge badge-blue">${currentUser.acesso}</span></div></div>
          <div class="divider"></div>
          <button class="btn btn-primary btn-sm" onclick="openChangePassword()"><i class="fas fa-key"></i> Alterar Senha</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-database" style="color:var(--gold-dark);margin-right:8px;"></i>Dados do Sistema</h3></div>
        <div class="card-body">
          <div class="detail-field"><div class="detail-label">Competências na Matriz</div><div class="detail-value fw-600">${(getStorage(STORAGE_KEYS.matriz)||[]).length} registros</div></div>
          <div class="detail-field"><div class="detail-label">Ações Educativas</div><div class="detail-value fw-600">${(getStorage(STORAGE_KEYS.acoes)||[]).length} registros</div></div>
          <div class="detail-field"><div class="detail-label">Trilhas de Aprendizagem</div><div class="detail-value fw-600">${(getStorage(STORAGE_KEYS.trilhas)||[]).length} registros</div></div>
          <div class="detail-field"><div class="detail-label">Planos de Ensino</div><div class="detail-value fw-600">${(getStorage(STORAGE_KEYS.pdi)||[]).length} registros</div></div>
          <div class="detail-field"><div class="detail-label">Usuários</div><div class="detail-value fw-600">${(getStorage(STORAGE_KEYS.users)||[]).length} registros</div></div>
          <div class="divider"></div>
          ${currentUser.acesso === 'Administrador' ? `<button class="btn btn-danger btn-sm" onclick="resetSystem()"><i class="fas fa-trash-can"></i> Reinicializar Sistema</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

export function openChangePassword() {
  const body = `
    <div class="form-group"><label>Senha Atual *</label><input type="password" id="cp-atual" placeholder="Sua senha atual"></div>
    <div class="form-group"><label>Nova Senha *</label><input type="password" id="cp-nova" placeholder="Mínimo 6 caracteres"></div>
    <div class="form-group"><label>Confirmar Nova Senha *</label><input type="password" id="cp-confirma" placeholder="Repita a nova senha"></div>
  `;
  openModal('Alterar Senha', body, `
    <button class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button class="btn btn-primary" onclick="void changePassword();"><i class="fas fa-key"></i> Alterar Senha</button>
  `);
}

export async function changePassword() {
  const atual = document.getElementById('cp-atual').value;
  const nova = document.getElementById('cp-nova').value;
  const confirma = document.getElementById('cp-confirma').value;
  if (!atual || !nova || !confirma) { showToast('Preencha todos os campos', 'warning'); return; }
  if (nova.length < 6) { showToast('Nova senha deve ter no mínimo 6 caracteres', 'warning'); return; }
  if (nova !== confirma) { showToast('As senhas não coincidem', 'error'); return; }
  try {
    const senhaAtualWire = await sha256HexUtf8(atual);
    const novaSenhaWire = await sha256HexUtf8(nova);
    await apiFetch('POST', '/users/change-password', { senha_atual: senhaAtualWire, nova_senha: novaSenhaWire });
    closeModalBtn();
    showToast('Senha alterada com sucesso!', 'success');
  } catch (err) {
    showToast(err.message || 'Erro ao alterar senha', 'error');
  }
}

export async function resetSystem() {
  if (!confirm('⚠️ ATENÇÃO: Esta ação irá apagar TODOS os dados do sistema exceto os usuários. Deseja continuar?')) return;
  if (!confirm('Tem certeza? Esta ação é IRREVERSÍVEL!')) return;
  try {
    await Promise.all([
      deleteStorage(STORAGE_KEYS.matriz),
      deleteStorage(STORAGE_KEYS.acoes),
      deleteStorage(STORAGE_KEYS.trilhas),
      deleteStorage(STORAGE_KEYS.pdi),
      deleteStorage(STORAGE_KEYS.moderacao),
      deleteStorage(STORAGE_KEYS.moderacao_historico),
    ]);
  } catch (err) {
    showToast(err.message || 'Erro ao reinicializar no banco', 'error');
    return;
  }
  globalThis.updateModeracaoNavBadge?.();
  showToast('Sistema reinicializado!', 'success');
  renderConfiguracoes();
}

Object.assign(globalThis, { renderConfiguracoes, openChangePassword, changePassword, resetSystem });
