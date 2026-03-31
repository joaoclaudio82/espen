/**
 * ESPEN – js/pdi.js
 * Planos de Desenvolvimento Individual: CRUD, progresso, DOCX.
 */

let pdiState = { data: [], editId: null };

const STATUS_PDI = ['Não iniciado', 'Em andamento', 'Concluído'];

function statusPdiBadge(v) {
  const map = { 'Não iniciado': 'badge-gray', 'Em andamento': 'badge-gold', Concluído: 'badge-success' };
  return `<span class="badge ${map[v] || 'badge-gray'}">${v || '—'}</span>`;
}

/* ── Render ──────────────────────────────────────────────────── */
function renderPDI() {
  const isAdmin = currentUser?.acesso === 'Administrador';

  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="exportPdiDOCX()">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
    <button class="btn btn-primary btn-sm" onclick="openPdiForm()">
      <i class="fas fa-plus"></i> <span class="btn-label">Novo PDI</span>
    </button>`;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Planos de Desenvolvimento Individual</h2>
        <p>Acompanhe o desenvolvimento formativo de cada servidor</p>
      </div>
    </div>
    <div id="pdi-list"></div>
    <!-- Modal -->
    <div class="modal-overlay" id="pdi-modal" onclick="if(event.target===this) closeModal('pdi-modal')">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="pdi-modal-title">Plano de Desenvolvimento Individual</h3>
          <button class="modal-close" onclick="closeModal('pdi-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="pdi-modal-body"></div>
        <div class="modal-footer" id="pdi-modal-footer"></div>
      </div>
    </div>`;

  pdiLoad();
}

function pdiLoad() {
  pdiState.data = JSON.parse(localStorage.getItem(LS_PDIS) || '[]');
  // Filtro por usuário (não-admin vê apenas seus próprios)
  if (currentUser?.acesso !== 'Administrador' && currentUser?.acesso !== 'Gestor') {
    pdiState.data = pdiState.data.filter(p => p.servidorId === currentUser?.id);
  }
  pdiRender();
}

function pdiRender() {
  const { data } = pdiState;
  const container = document.getElementById('pdi-list');
  if (!container) return;

  if (!data.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px 20px;">
        <i class="fas fa-tasks"></i>
        <h3>Nenhum PDI encontrado</h3>
        <p>Crie planos de desenvolvimento individual para acompanhar a formação dos servidores.</p>
        <button class="btn btn-primary mt-16" onclick="openPdiForm()">
          <i class="fas fa-plus"></i> Criar PDI
        </button>
      </div>`;
    return;
  }

  const users   = JSON.parse(localStorage.getItem(LS_USERS)  || '[]');
  const trilhas = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]');
  const acoes   = JSON.parse(localStorage.getItem(LS_ACOES)   || '[]');

  container.innerHTML = data.map(p => {
    const user   = users.find(u => u.id === p.servidorId);
    const trilha = trilhas.find(t => t.id === p.trilhaId);
    const acoesT = (trilha?.acoesVinculadas || []).map(id => acoes.find(a => a.id === id)).filter(Boolean);
    const done   = (p.acoesFeitas || []).filter(Boolean).length;
    const total  = acoesT.length;
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

    const initials = user ? user.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : '??';

    return `
      <div class="card mb-20">
        <div class="card-header">
          <h3>
            <div class="user-avatar" style="width:28px;height:28px;font-size:11px;">${initials}</div>
            ${user?.nome || 'Servidor não encontrado'}
          </h3>
          <div style="display:flex;gap:8px;align-items:center;">
            ${statusPdiBadge(p.status)}
            <button class="btn-icon btn-sm" onclick="openPdiForm('${p.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-sm danger" onclick="deletePdi('${p.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="detail-grid mb-16">
          <div class="detail-item">
            <div class="detail-label">Trilha Vinculada</div>
            <div class="detail-value">${trilha?.nome || '—'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Cargo-alvo da Trilha</div>
            <div class="detail-value">${trilha?.cargoAlvo || '—'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Data de Início</div>
            <div class="detail-value">${p.dataInicio ? formatDate(new Date(p.dataInicio).getTime()) : '—'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Data Meta</div>
            <div class="detail-value">${p.dataMeta ? formatDate(new Date(p.dataMeta).getTime()) : '—'}</div>
          </div>
        </div>
        <!-- Progress -->
        <div class="mb-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:13px;font-weight:600;color:var(--gray-700)">Progresso</span>
            <span style="font-size:14px;font-weight:800;color:var(--navy)">${pct}%</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill ${pct === 100 ? 'success' : ''}" style="width:${pct}%"></div>
          </div>
          <div style="font-size:11px;color:var(--gray-500);margin-top:4px;">${done} de ${total} ações concluídas</div>
        </div>
        <!-- Checklist -->
        ${acoesT.length > 0 ? `
        <div class="checklist">
          ${acoesT.map((a, i) => {
            const feita = (p.acoesFeitas || [])[i] || false;
            return `
              <div class="checklist-item">
                <input type="checkbox" ${feita ? 'checked' : ''}
                  onchange="togglePdiAcao('${p.id}', ${i})">
                <div>
                  <div class="checklist-label ${feita ? 'done' : ''}">${a.nome}</div>
                  <div style="font-size:11px;color:var(--gray-500);">${a.cargaHoraria}h · ${a.modalidade} · ${statusBadge(a.status)}</div>
                </div>
              </div>`;
          }).join('')}
        </div>` : '<p class="text-muted fs-13">Trilha sem ações vinculadas.</p>'}
      </div>`;
  }).join('');
}

/* ── Toggle ação concluída ───────────────────────────────────── */
function togglePdiAcao(pdiId, acaoIdx) {
  const allPdis = JSON.parse(localStorage.getItem(LS_PDIS) || '[]');
  const pdi     = allPdis.find(p => p.id === pdiId);
  if (!pdi) return;

  const trilha = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]').find(t => t.id === pdi.trilhaId);
  const total  = (trilha?.acoesVinculadas || []).length;

  if (!pdi.acoesFeitas || pdi.acoesFeitas.length !== total) {
    pdi.acoesFeitas = new Array(total).fill(false);
  }
  pdi.acoesFeitas[acaoIdx] = !pdi.acoesFeitas[acaoIdx];

  const done = pdi.acoesFeitas.filter(Boolean).length;
  if (done === 0)     pdi.status = 'Não iniciado';
  else if (done < total) pdi.status = 'Em andamento';
  else               pdi.status = 'Concluído';

  pdi.updatedAt = Date.now();
  localStorage.setItem(LS_PDIS, JSON.stringify(allPdis));
  pdiLoad();
}

/* ── Formulário ──────────────────────────────────────────────── */
function openPdiForm(id = null) {
  pdiState.editId = id;
  const p       = id ? JSON.parse(localStorage.getItem(LS_PDIS) || '[]').find(x => x.id === id) : null;
  const users   = JSON.parse(localStorage.getItem(LS_USERS)   || '[]').filter(u => u.ativo);
  const trilhas = JSON.parse(localStorage.getItem(LS_TRILHAS)  || '[]');

  document.getElementById('pdi-modal-title').textContent = id ? 'Editar PDI' : 'Novo PDI';
  document.getElementById('pdi-modal-body').innerHTML = `
    <form id="pdi-form">
      <div class="form-section">
        <div class="form-section-title">Dados do Plano</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Servidor *</label>
            <select class="form-control" id="pf-servidor" required>
              <option value="">Selecione o servidor</option>
              ${users.map(u => `<option value="${u.id}" ${u.id === p?.servidorId ? 'selected' : ''}>${u.nome} – ${u.cargo}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Trilha Vinculada</label>
            <select class="form-control" id="pf-trilha">
              <option value="">Sem trilha vinculada</option>
              ${trilhas.map(t => `<option value="${t.id}" ${t.id === p?.trilhaId ? 'selected' : ''}>${t.nome} (${t.cargoAlvo})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Data de Início</label>
            <input type="date" class="form-control" id="pf-inicio" value="${p?.dataInicio || ''}">
          </div>
          <div class="form-group">
            <label>Data Meta</label>
            <input type="date" class="form-control" id="pf-meta" value="${p?.dataMeta || ''}">
          </div>
          <div class="form-group">
            <label>Status</label>
            <select class="form-control" id="pf-status">
              ${STATUS_PDI.map(s => `<option value="${s}" ${s === (p?.status || 'Não iniciado') ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </form>`;

  document.getElementById('pdi-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('pdi-modal')">Cancelar</button>
    <button class="btn btn-primary" onclick="savePdi()">
      <i class="fas fa-save"></i> Salvar
    </button>`;

  openModal('pdi-modal');
}

function savePdi() {
  const servidorId = document.getElementById('pf-servidor')?.value;
  const trilhaId   = document.getElementById('pf-trilha')?.value;
  const dataInicio = document.getElementById('pf-inicio')?.value;
  const dataMeta   = document.getElementById('pf-meta')?.value;
  const status     = document.getElementById('pf-status')?.value || 'Não iniciado';

  if (!servidorId) { showToast('Selecione o servidor.', 'danger'); return; }

  const allPdis = JSON.parse(localStorage.getItem(LS_PDIS) || '[]');
  const trilha  = JSON.parse(localStorage.getItem(LS_TRILHAS) || '[]').find(t => t.id === trilhaId);
  const total   = (trilha?.acoesVinculadas || []).length;

  const fields = {
    servidorId, trilhaId, dataInicio, dataMeta, status,
    acoesFeitas: new Array(total).fill(false),
    updatedAt: Date.now(),
  };

  if (pdiState.editId) {
    const idx = allPdis.findIndex(p => p.id === pdiState.editId);
    if (idx !== -1) {
      // Preserva progresso existente se trilha não mudou
      const existing = allPdis[idx];
      if (existing.trilhaId === trilhaId) fields.acoesFeitas = existing.acoesFeitas;
      allPdis[idx] = { ...existing, ...fields };
    }
    logActivity('update', `PDI de <strong>${servidorId}</strong> atualizado.`);
    showToast('PDI atualizado!', 'success');
  } else {
    const user = JSON.parse(localStorage.getItem(LS_USERS) || '[]').find(u => u.id === servidorId);
    allPdis.push({ id: generateId('pdi'), ...fields, createdAt: Date.now() });
    logActivity('create', `Novo PDI criado para <strong>${user?.nome || 'servidor'}</strong>.`);
    showToast('PDI criado!', 'success');
  }
  localStorage.setItem(LS_PDIS, JSON.stringify(allPdis));
  closeModal('pdi-modal');
  pdiLoad();
}

function deletePdi(id) {
  const allPdis = JSON.parse(localStorage.getItem(LS_PDIS) || '[]');
  const p = allPdis.find(x => x.id === id);
  if (!p || !confirm('Excluir este PDI?')) return;
  localStorage.setItem(LS_PDIS, JSON.stringify(allPdis.filter(x => x.id !== id)));
  logActivity('delete', `PDI excluído.`);
  showToast('PDI excluído.', 'success');
  pdiLoad();
}

/* ── Export DOCX ─────────────────────────────────────────────── */
async function exportPdiDOCX() {
  const lib = typeof docx !== 'undefined' ? docx : window.docx;
  if (!lib) { showToast('Biblioteca DOCX ainda carregando.', 'warning'); return; }
  const data = pdiState.data;
  if (!data.length) { showToast('Nenhum PDI para exportar.', 'warning'); return; }
  showToast(`Gerando DOCX com ${data.length} PDIs…`, 'info', 5000);

  const { Document, Packer, Paragraph, TextRun, PageBreak } = lib;
  const users   = JSON.parse(localStorage.getItem(LS_USERS)   || '[]');
  const trilhas = JSON.parse(localStorage.getItem(LS_TRILHAS)  || '[]');
  const acoes   = JSON.parse(localStorage.getItem(LS_ACOES)    || '[]');

  const sections = [];
  data.forEach((p, i) => {
    if (i > 0) sections.push(new Paragraph({ children: [new PageBreak()] }));
    const user   = users.find(u => u.id === p.servidorId);
    const trilha = trilhas.find(t => t.id === p.trilhaId);
    const acoesT = (trilha?.acoesVinculadas || []).map(id => acoes.find(a => a.id === id)).filter(Boolean);
    const done   = (p.acoesFeitas || []).filter(Boolean).length;
    const total  = acoesT.length;
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;

    sections.push(
      new Paragraph({ children: [new TextRun({ text: `PDI – ${user?.nome || 'Servidor'}`, bold: true, size: 28, color: '1a237e', font: 'Calibri' })] }),
      new Paragraph({ text: '' }),
      ...[ ['Servidor', user?.nome || '—'], ['Cargo', user?.cargo || '—'],
           ['Trilha', trilha?.nome || '—'], ['Cargo-alvo', trilha?.cargoAlvo || '—'],
           ['Status', p.status], ['Progresso', `${pct}%  (${done}/${total} ações)`],
           ['Data Início', p.dataInicio || '—'], ['Data Meta', p.dataMeta || '—'],
      ].map(([label, val]) =>
        new Paragraph({ children: [
          new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: String(val), size: 20, font: 'Calibri' }),
        ] })
      ),
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: 'Ações da Trilha:', bold: true, size: 22, font: 'Calibri' })] }),
      ...acoesT.map((a, idx) =>
        new Paragraph({ children: [
          new TextRun({ text: `${(p.acoesFeitas || [])[idx] ? '☑' : '☐'} ${idx + 1}. `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: `${a.nome} (${a.cargaHoraria}h – ${a.modalidade})`, size: 20, font: 'Calibri' }),
        ] })
      )
    );
  });

  const doc  = new Document({ sections: [{ children: sections }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ESPEN_PDI_${Date.now()}.docx`; a.click();
  URL.revokeObjectURL(url);
  showToast(`DOCX gerado com ${data.length} PDIs!`, 'success');
}
