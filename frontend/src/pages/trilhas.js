/**
 * Página "Trilhas de Aprendizagem" — cards com timeline das ações vinculadas,
 * formulário (modal) para criar/editar, exclusão. Edições não-admin passam
 * pela fila de moderação.
 */
import { STORAGE_KEYS, getStorage, setStorage } from '../api/storage.js';
import { isAdminUser, isSomenteLeitura, usaFilaModeracao } from '../auth/roles.js';
import { closeModalBtn, openModal } from '../router.js';
import { genId, idEquals } from '../shared/format.js';
import { pushFilaModeracao } from '../shared/moderacao.js';
import { showToast } from '../shared/toast.js';

export function renderTrilhas() {
  const podeAlterar = !isSomenteLeitura();
  document.getElementById('topbar-actions').innerHTML = podeAlterar ? `
    <button class="btn btn-gold btn-sm" onclick="openTrilhaForm()"><i class="fas fa-plus"></i> <span class="btn-label">Nova Trilha</span></button>
    ${isAdminUser() ? `<button class="btn btn-secondary btn-sm" onclick="importExcelData(STORAGE_KEYS.trilhas)" title="Importar Excel"><i class="fas fa-file-import"></i> <span class="btn-label">Importar Excel</span></button>` : ''}
  ` : '';

  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];

  let html = `
    <div class="section-header">
      <div>
        <div class="section-title">Trilhas de Aprendizagem</div>
        <div class="section-sub">Monte percursos de desenvolvimento por cargo e eixo funcional</div>
      </div>
    </div>
  `;

  if (trilhas.length === 0) {
    html += `<div class="empty-state" style="margin-top:60px;">
      <i class="fas fa-route"></i>
      <h3>Nenhuma trilha cadastrada</h3>
      <p>Crie trilhas combinando ações educativas em sequência lógica.</p>
      ${podeAlterar ? `<button class="btn btn-primary" onclick="openTrilhaForm()"><i class="fas fa-plus"></i> Criar Primeira Trilha</button>` : ''}
    </div>`;
  } else {
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px;">`;
    const nivelColors = { Básico: 'green', Intermediário: 'gold', Avançado: 'blue' };
    trilhas.forEach((t) => {
      const totalHoras = (t.acoes_vinculadas || []).reduce((sum, aid) => {
        const a = acoes.find((x) => idEquals(x.id, aid));
        return sum + (a ? a.carga_horaria : 0);
      }, 0);
      html += `
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${t.nome||'—'}</h3>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <span class="badge badge-${nivelColors[t.nivel]||'gray'}">${t.nivel||'—'}</span>
                ${t.cargo_alvo ? `<span class="badge badge-blue">${t.cargo_alvo.split(' ')[0]}</span>` : ''}
              </div>
            </div>
            ${podeAlterar ? `<div style="display:flex;gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="editTrilha('${t.id}')"><i class="fas fa-edit"></i></button>
              <button class="btn btn-danger btn-sm" onclick="deleteTrilha('${t.id}')"><i class="fas fa-trash"></i></button>
            </div>` : ''}
          </div>
          <div class="card-body">
            <p style="font-size:13px;color:var(--gray-600);margin-bottom:14px;">${t.descricao||'—'}</p>
            <div style="display:flex;gap:16px;margin-bottom:14px;font-size:12px;">
              <span><i class="fas fa-clock" style="color:var(--navy);margin-right:4px;"></i>${totalHoras}h total</span>
              <span><i class="fas fa-book-open" style="color:var(--gold-dark);margin-right:4px;"></i>${(t.acoes_vinculadas||[]).length} ações</span>
              ${t.eixo_funcional ? `<span><i class="fas fa-layer-group" style="color:var(--success);margin-right:4px;"></i>${t.eixo_funcional.substring(0,20)}…</span>` : ''}
            </div>
            <div class="timeline">
              ${(t.acoes_vinculadas||[]).slice(0,4).map((aid) => {
                const a = acoes.find((x) => idEquals(x.id, aid));
                return `<div class="timeline-item">
                  <div class="timeline-title">${a ? a.nome.substring(0,50)+'…' : 'Ação não encontrada'}</div>
                  <div class="timeline-sub">${a ? `${a.modalidade} • ${a.carga_horaria}h` : ''}</div>
                </div>`;
              }).join('')}
              ${(t.acoes_vinculadas||[]).length > 4 ? `<div style="font-size:12px;color:var(--gray-500);margin-left:28px;">+${(t.acoes_vinculadas||[]).length - 4} mais ações</div>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  document.getElementById('page-content').innerHTML = html;
}

export function openTrilhaForm(id = null) {
  const trilhas = getStorage(STORAGE_KEYS.trilhas) || [];
  const acoes = getStorage(STORAGE_KEYS.acoes) || [];
  const t = id ? (trilhas.find((x) => idEquals(x.id, id)) || {}) : {};
  const selected = t.acoes_vinculadas || [];

  const body = `
    <div class="form-grid">
      <div class="form-group form-full"><label>Nome da Trilha *</label><input type="text" id="tf-nome" value="${t.nome||''}" placeholder="Ex: Trilha de Formação Básica - Policial Penal"></div>
      <div class="form-group form-full"><label>Descrição</label><textarea id="tf-descricao" rows="2">${t.descricao||''}</textarea></div>
      <div class="form-group">
        <label>Cargo-Alvo</label>
        <select id="tf-cargo">
          <option value="">Todos</option>
          <option ${t.cargo_alvo==='Policial Penal'?'selected':''}>Policial Penal</option>
          <option ${t.cargo_alvo==='Especialista Federal em Assistência à Execução Penal'?'selected':''}>Especialista Federal em Assistência à Execução Penal</option>
          <option ${t.cargo_alvo==='Técnico Federal de Apoio à Execução Penal'?'selected':''}>Técnico Federal de Apoio à Execução Penal</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nível</label>
        <select id="tf-nivel">
          <option value="">Selecione...</option>
          <option ${t.nivel==='Básico'?'selected':''}>Básico</option>
          <option ${t.nivel==='Intermediário'?'selected':''}>Intermediário</option>
          <option ${t.nivel==='Avançado'?'selected':''}>Avançado</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label>Eixo Funcional</label>
        <select id="tf-eixo">
          <option value="">Selecione...</option>
          <option ${t.eixo_funcional==='Operação e controle de Unidades Prisionais'?'selected':''}>Operação e controle de Unidades Prisionais</option>
          <option ${t.eixo_funcional==='Policiamento Penal'?'selected':''}>Policiamento Penal</option>
          <option ${t.eixo_funcional==='Governança do Sistema Penal'?'selected':''}>Governança do Sistema Penal</option>
          <option ${t.eixo_funcional==='Gestão dos Serviços Penais'?'selected':''}>Gestão dos Serviços Penais</option>
          <option ${t.eixo_funcional==='Neoprofessor dos Serviços Penais'?'selected':''}>Neoprofessor dos Serviços Penais</option>
        </select>
      </div>
    </div>
    <div class="form-section-title" style="margin-top:20px;">Ações Educativas Vinculadas (em ordem)</div>
    <div style="max-height:200px;overflow-y:auto;border:1.5px solid var(--gray-200);border-radius:8px;padding:10px;margin-bottom:12px;">
      ${acoes.map(a => `
        <label style="display:flex;align-items:center;gap:10px;padding:6px;cursor:pointer;border-radius:6px;font-size:13px;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
          <input type="checkbox" name="trilha-acao" value="${a.id}" ${selected.includes(a.id)?'checked':''} style="width:15px;height:15px;">
          <span><strong>${a.codigo||''}</strong> ${a.nome} <span style="color:var(--gray-500);">(${a.carga_horaria}h)</span></span>
        </label>
      `).join('')}
    </div>
    <p style="font-size:12px;color:var(--gray-500);"><i class="fas fa-info-circle"></i> Carga horária total será calculada automaticamente.</p>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveTrilha('${id||''}')"><i class="fas fa-save"></i> ${id?'Salvar':'Criar Trilha'}</button>
  `;
  openModal(id ? 'Editar Trilha' : 'Nova Trilha de Aprendizagem', body, footer, true);
}

export function editTrilha(id) { openTrilhaForm(id); }

export function saveTrilha(id) {
  const nome = document.getElementById('tf-nome').value.trim();
  if (!nome) { showToast('Informe o nome da trilha', 'warning'); return; }
  const checkboxes = document.querySelectorAll('input[name="trilha-acao"]:checked');
  const acoes_vinculadas = Array.from(checkboxes).map((cb) => cb.value);
  const rec = {
    nome,
    descricao: document.getElementById('tf-descricao').value.trim(),
    cargo_alvo: document.getElementById('tf-cargo').value,
    nivel: document.getElementById('tf-nivel').value,
    eixo_funcional: document.getElementById('tf-eixo').value,
    acoes_vinculadas,
  };
  const data = getStorage(STORAGE_KEYS.trilhas) || [];
  if (id) {
    const idx = data.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const merged = { ...data[idx], ...rec };
    if (usaFilaModeracao()) {
      pushFilaModeracao('trilha_upsert', { editId: id, registro: merged });
      closeModalBtn();
      showToast('Alteração enviada para aprovação do administrador.', 'info');
      return;
    }
    data[idx] = merged;
  } else {
    const novo = { id: genId(), ...rec, data_criacao: new Date().toISOString() };
    if (usaFilaModeracao()) {
      pushFilaModeracao('trilha_upsert', { editId: null, registro: novo });
      closeModalBtn();
      showToast('Cadastro enviado para aprovação do administrador.', 'info');
      return;
    }
    data.push(novo);
  }
  setStorage(STORAGE_KEYS.trilhas, data);
  closeModalBtn();
  showToast(id ? 'Trilha atualizada!' : 'Trilha criada!', 'success');
  renderTrilhas();
}

export function deleteTrilha(id) {
  if (!confirm('Deseja excluir esta trilha?')) return;
  if (usaFilaModeracao()) {
    pushFilaModeracao('trilha_excluir', { id });
    showToast('Solicitação enviada ao administrador.', 'info');
    renderTrilhas();
    return;
  }
  const data = (getStorage(STORAGE_KEYS.trilhas) || []).filter((x) => x.id !== id);
  setStorage(STORAGE_KEYS.trilhas, data);
  showToast('Trilha excluída.', 'success');
  renderTrilhas();
}

Object.assign(globalThis, { renderTrilhas, openTrilhaForm, editTrilha, saveTrilha, deleteTrilha });
