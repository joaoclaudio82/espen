/**
 * ESPEN – js/trilhas.js
 * Módulo Trilhas de Aprendizagem: CRUD, timeline visual, carga horária.
 */

let trilhasState = { data: [], editId: null };

/* ── Render principal ────────────────────────────────────────── */
function renderTrilhas() {
  const isAdmin = currentUser?.acesso === 'Administrador';
  const d = window.ESPEN_DATA || {};

  document.getElementById('topbar-actions').innerHTML = `
    ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="openTrilhaForm()">
      <i class="fas fa-plus"></i> <span class="btn-label">Nova Trilha</span>
    </button>` : ''}`;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Trilhas de Aprendizagem</h2>
        <p>Percursos formativos que combinam ações educativas em sequência lógica</p>
      </div>
    </div>
    <div id="trilhas-list"></div>
    <!-- Modal -->
    <div class="modal-overlay" id="trl-modal" onclick="if(event.target===this) closeModal('trl-modal')">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="trl-modal-title">Trilha de Aprendizagem</h3>
          <button class="modal-close" onclick="closeModal('trl-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="trl-modal-body"></div>
        <div class="modal-footer" id="trl-modal-footer"></div>
      </div>
    </div>`;

  trilhasLoad();
}

function trilhasLoad() {
  trilhasState.data = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]');
  trilhasRender();
}

function trilhasRender() {
  const { data } = trilhasState;
  const isAdmin  = currentUser?.acesso === 'Administrador';
  const container = document.getElementById('trilhas-list');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px 20px;">
        <i class="fas fa-route"></i>
        <h3>Nenhuma trilha criada</h3>
        <p>Crie trilhas de aprendizagem para organizar ações educativas em percursos formativos.</p>
        ${isAdmin ? `<button class="btn btn-primary mt-16" onclick="openTrilhaForm()">
          <i class="fas fa-plus"></i> Criar primeira trilha
        </button>` : ''}
      </div>`;
    return;
  }

  container.innerHTML = data.map(t => {
    const acoes = JSON.parse(localStorage.getItem(LS_ACOES) || '[]');
    const acoesVinculadas = (t.acoesVinculadas || []).map(id => acoes.find(a => a.id === id)).filter(Boolean);
    const totalHoras = acoesVinculadas.reduce((s, a) => s + (a.cargaHoraria || 0), 0);
    const nivelBadge = { Básico: 'badge-info', Intermediário: 'badge-navy', Avançado: 'badge-gold' };

    return `
      <div class="card mb-20">
        <div class="card-header">
          <h3>
            <i class="fas fa-route" style="color:var(--gold)"></i>
            ${t.nome}
          </h3>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="badge ${nivelBadge[t.nivel] || 'badge-gray'}">${t.nivel || '—'}</span>
            <span class="chip"><i class="fas fa-clock"></i> ${totalHoras}h total</span>
            ${isAdmin ? `
            <button class="btn-icon btn-sm" onclick="openTrilhaForm('${t.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-sm danger" onclick="deleteTrilha('${t.id}')"><i class="fas fa-trash"></i></button>
            ` : ''}
          </div>
        </div>
        <div class="detail-grid mb-16">
          <div class="detail-item">
            <div class="detail-label">Cargo-alvo</div>
            <div class="detail-value">${t.cargoAlvo || '—'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Eixo Funcional</div>
            <div class="detail-value">${t.eixo || '—'}</div>
          </div>
          <div class="detail-item full">
            <div class="detail-label">Descrição</div>
            <div class="detail-value">${t.descricao || '—'}</div>
          </div>
        </div>
        ${acoesVinculadas.length ? `
        <div class="timeline">
          ${acoesVinculadas.map((a, i) => `
            <div class="timeline-item">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-title">${i + 1}. ${a.nome}</div>
                <div class="timeline-meta">
                  <span><i class="fas fa-tag"></i> ${a.tipo || '—'}</span>
                  <span><i class="fas fa-clock"></i> ${a.cargaHoraria || 0}h</span>
                  <span><i class="fas fa-laptop"></i> ${a.modalidade || '—'}</span>
                  <span>${statusBadge(a.status)}</span>
                </div>
              </div>
            </div>`).join('')}
        </div>` : `<p class="text-muted fs-13" style="padding:12px 0;">Nenhuma ação vinculada ainda.</p>`}
      </div>`;
  }).join('');
}

/* ── Formulário CRUD ─────────────────────────────────────────── */
function openTrilhaForm(id = null) {
  trilhasState.editId = id;
  const t = id ? trilhasState.data.find(x => x.id === id) : null;
  const d = window.ESPEN_DATA || {};
  const acoes = JSON.parse(localStorage.getItem(LS_ACOES) || '[]');
  const sel = (arr, val) => arr.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');

  document.getElementById('trl-modal-title').textContent = id ? 'Editar Trilha' : 'Nova Trilha';
  document.getElementById('trl-modal-body').innerHTML = `
    <form id="trl-form">
      <div class="form-section">
        <div class="form-section-title">Identificação da Trilha</div>
        <div class="form-grid">
          <div class="form-group col-span-2">
            <label>Nome da Trilha *</label>
            <input class="form-control" id="tf-nome" required value="${t?.nome || ''}">
          </div>
          <div class="form-group col-span-2">
            <label>Descrição</label>
            <textarea class="form-control" id="tf-descricao" rows="2">${t?.descricao || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Cargo-alvo *</label>
            <select class="form-control" id="tf-cargo" required>
              <option value="">Selecione</option>
              ${sel(d.CARGOS || [], t?.cargoAlvo)}
            </select>
          </div>
          <div class="form-group">
            <label>Eixo Funcional</label>
            <select class="form-control" id="tf-eixo">
              <option value="">Selecione</option>
              ${sel(d.EIXOS || [], t?.eixo)}
            </select>
          </div>
          <div class="form-group">
            <label>Nível</label>
            <select class="form-control" id="tf-nivel">
              <option value="">Selecione</option>
              ${sel(d.TIPOLOGIAS_COMPLEXIDADE || [], t?.nivel)}
            </select>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Ações Vinculadas (ordenadas)</div>
        <p class="text-muted fs-12 mb-12">Selecione as ações que compõem esta trilha. A ordem de seleção será mantida.</p>
        <div style="max-height:250px;overflow-y:auto;border:1.5px solid var(--gray-300);border-radius:var(--radius);padding:8px;">
          ${acoes.length === 0 ? '<p class="text-muted fs-13" style="padding:8px;">Nenhuma ação cadastrada ainda.</p>' :
            acoes.map(a => `
              <label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:6px;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">
                <input type="checkbox" value="${a.id}" class="trl-acao-cb" style="accent-color:var(--navy);" ${(t?.acoesVinculadas || []).includes(a.id) ? 'checked' : ''}>
                <div>
                  <div style="font-size:13px;font-weight:600;">${a.nome}</div>
                  <div style="font-size:11px;color:var(--gray-500);">${a.tipo} · ${a.cargaHoraria}h · ${a.modalidade}</div>
                </div>
              </label>`).join('')}
        </div>
      </div>
    </form>`;

  document.getElementById('trl-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('trl-modal')">Cancelar</button>
    <button class="btn btn-primary" onclick="saveTrilha()">
      <i class="fas fa-save"></i> Salvar
    </button>`;

  openModal('trl-modal');
}

function saveTrilha() {
  const nome    = document.getElementById('tf-nome')?.value.trim();
  const descricao = document.getElementById('tf-descricao')?.value.trim();
  const cargoAlvo = document.getElementById('tf-cargo')?.value;
  const eixo    = document.getElementById('tf-eixo')?.value;
  const nivel   = document.getElementById('tf-nivel')?.value;
  const acoesVinculadas = [...document.querySelectorAll('.trl-acao-cb:checked')].map(cb => cb.value);

  if (!nome || !cargoAlvo) { showToast('Informe o Nome e Cargo-alvo da trilha.', 'danger'); return; }

  const trilhas = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]');
  const fields  = { nome, descricao, cargoAlvo, eixo, nivel, acoesVinculadas };

  if (trilhasState.editId) {
    const idx = trilhas.findIndex(t => t.id === trilhasState.editId);
    if (idx !== -1) { trilhas[idx] = { ...trilhas[idx], ...fields, updatedAt: Date.now() }; }
    logActivity('update', `Trilha <strong>${nome}</strong> atualizada.`);
    showToast('Trilha atualizada!', 'success');
  } else {
    trilhas.push({ id: generateId('trilha'), ...fields, createdAt: Date.now(), updatedAt: Date.now() });
    logActivity('create', `Nova trilha <strong>${nome}</strong> criada.`);
    showToast('Trilha criada!', 'success');
  }
  localStorage.setItem(LS_TRILHAS, JSON.stringify(trilhas));
  closeModal('trl-modal');
  trilhasLoad();
}

function deleteTrilha(id) {
  const trilhas = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]');
  const t = trilhas.find(x => x.id === id);
  if (!t || !confirm(`Excluir a trilha "${t.nome}"?`)) return;
  localStorage.setItem(LS_TRILHAS, JSON.stringify(trilhas.filter(x => x.id !== id)));
  logActivity('delete', `Trilha <strong>${t.nome}</strong> excluída.`);
  showToast('Trilha excluída.', 'success');
  trilhasLoad();
}
