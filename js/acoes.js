/**
 * ESPEN – js/acoes.js
 * Módulo Ações Educativas: listagem, filtros, CRUD 27 campos, DOCX.
 */

let acoesState = {
  data: [], filtered: [], page: 1, pageSize: 10,
  filters: { search: '', modalidade: '', status: '', eixo: '' },
  editId: null,
};

/* ── Helpers ─────────────────────────────────────────────────── */
function statusBadge(v) {
  const map = { Planejada: 'badge-info', 'Em execução': 'badge-gold', Concluída: 'badge-success', Cancelada: 'badge-danger' };
  return `<span class="badge ${map[v] || 'badge-gray'}">${v || '—'}</span>`;
}
function modalidadeBadge(v) {
  const map = { Presencial: 'badge-navy', EaD: 'badge-info', Semipresencial: 'badge-gold', Híbrido: 'badge-success' };
  return `<span class="badge ${map[v] || 'badge-gray'}">${v || '—'}</span>`;
}

/* ── Render principal ────────────────────────────────────────── */
function renderAcoes() {
  const d = window.ESPEN_DATA || {};
  const isAdmin = currentUser?.acesso === 'Administrador';

  document.getElementById('topbar-actions').innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="exportAcoesDOCX()">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
    ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="openAcaoForm()">
      <i class="fas fa-plus"></i> <span class="btn-label">Nova Ação</span>
    </button>` : ''}`;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Ações Educativas</h2>
        <p>Cadastro unificado de cursos, programas e workshops ESPEN</p>
      </div>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="ac-search" placeholder="Buscar ação educativa…" oninput="acoesFilter()">
        </div>
      </div>
      <div class="filter-bar">
        <select class="filter-select" id="ac-modalidade" onchange="acoesFilter()">
          <option value="">Todas as modalidades</option>
          ${(d.MODALIDADES || []).map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <select class="filter-select" id="ac-status" onchange="acoesFilter()">
          <option value="">Todos os status</option>
          ${(d.STATUS_ACAO || []).map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <select class="filter-select" id="ac-eixo" onchange="acoesFilter()">
          <option value="">Todos os eixos</option>
          ${(d.EIXOS || []).map(e => `<option value="${e}">${e}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="acoesFilter(true)">
          <i class="fas fa-times"></i> Limpar
        </button>
      </div>
      <div class="table-scroll desktop-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome da Ação</th>
              <th class="hide-mobile">Modalidade</th>
              <th class="hide-mobile">Carga Horária</th>
              <th class="hide-mobile">Eixo</th>
              <th>Status</th>
              <th style="width:90px">Ações</th>
            </tr>
          </thead>
          <tbody id="ac-tbody"></tbody>
        </table>
      </div>
      <div class="mobile-cards" id="ac-mobile-cards"></div>
      <div class="table-footer">
        <div class="table-info" id="ac-info"></div>
        <div class="pagination" id="ac-pagination"></div>
      </div>
    </div>
    <!-- Modal -->
    <div class="modal-overlay" id="ac-modal" onclick="if(event.target===this) closeModal('ac-modal')">
      <div class="modal modal-xl">
        <div class="modal-header">
          <h3 id="ac-modal-title">Ação Educativa</h3>
          <button class="modal-close" onclick="closeModal('ac-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="ac-modal-body"></div>
        <div class="modal-footer" id="ac-modal-footer"></div>
      </div>
    </div>`;

  acoesLoad();
}

function acoesLoad() {
  acoesState.data     = JSON.parse(localStorage.getItem(LS_ACOES) || '[]');
  acoesState.filtered = [...acoesState.data];
  acoesState.page     = 1;
  acoesRender();
}

function acoesFilter(clear = false) {
  if (clear) {
    ['ac-search','ac-modalidade','ac-status','ac-eixo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  }
  const search    = document.getElementById('ac-search')?.value.toLowerCase() || '';
  const modalidade = document.getElementById('ac-modalidade')?.value || '';
  const status    = document.getElementById('ac-status')?.value || '';
  const eixo      = document.getElementById('ac-eixo')?.value || '';

  acoesState.filtered = acoesState.data.filter(a => {
    if (search && !JSON.stringify(a).toLowerCase().includes(search)) return false;
    if (modalidade && a.modalidade !== modalidade) return false;
    if (status    && a.status !== status)           return false;
    if (eixo      && a.eixo !== eixo)               return false;
    return true;
  });
  acoesState.page = 1;
  acoesRender();
}

function acoesRender() {
  const { filtered, page, pageSize } = acoesState;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const isAdmin = currentUser?.acesso === 'Administrador';

  const tbody = document.getElementById('ac-tbody');
  if (tbody) {
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state"><i class="fas fa-graduation-cap"></i><h3>Nenhuma ação encontrada</h3></div>
      </td></tr>`;
    } else {
      tbody.innerHTML = slice.map(a => `
        <tr class="clickable" onclick="acoesShowDetail('${a.id}')">
          <td><span class="badge badge-gray" style="font-size:10px;">${a.codigo || '—'}</span></td>
          <td>
            <div style="font-weight:600;color:var(--navy);font-size:13px;">${truncate(a.nome, 50)}</div>
            <div style="font-size:11px;color:var(--gray-500);">${a.tipo || ''} · ${a.publicoAlvo || ''}</div>
          </td>
          <td class="hide-mobile">${modalidadeBadge(a.modalidade)}</td>
          <td class="hide-mobile"><span style="font-weight:600;">${a.cargaHoraria || 0}h</span></td>
          <td class="hide-mobile"><span style="font-size:11px;color:var(--gray-600);">${(a.eixo || '—').replace('Eixo ','E')}</span></td>
          <td>${statusBadge(a.status)}</td>
          <td onclick="event.stopPropagation()">
            <div style="display:flex;gap:4px;">
              <button class="btn-icon btn-sm" title="Ver" onclick="acoesShowDetail('${a.id}')">
                <i class="fas fa-eye"></i>
              </button>
              ${isAdmin ? `
              <button class="btn-icon btn-sm" title="Editar" onclick="openAcaoForm('${a.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon btn-sm danger" title="Excluir" onclick="deleteAcao('${a.id}')">
                <i class="fas fa-trash"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>`).join('');
    }
  }

  const mobileCards = document.getElementById('ac-mobile-cards');
  if (mobileCards) {
    mobileCards.innerHTML = slice.map(a => `
      <div class="activity-item" style="cursor:pointer;padding:12px 16px;" onclick="acoesShowDetail('${a.id}')">
        <div style="flex:1;">
          <div style="font-weight:600;color:var(--navy);font-size:13px;margin-bottom:4px;">${a.nome}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${modalidadeBadge(a.modalidade)} ${statusBadge(a.status)}</div>
          <div style="font-size:11px;color:var(--gray-600);margin-top:4px;">${a.cargaHoraria}h · ${a.publicoAlvo}</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--gray-400);"></i>
      </div>`).join('') || `<div class="empty-state"><i class="fas fa-graduation-cap"></i><p>Nenhuma ação encontrada</p></div>`;
  }

  const info = document.getElementById('ac-info');
  if (info) info.textContent = `Exibindo ${Math.min(start + 1, total)}–${Math.min(start + pageSize, total)} de ${total} ações`;

  const pag = document.getElementById('ac-pagination');
  if (pag) pag.innerHTML = buildPagination(page, Math.ceil(total / pageSize), 'acoesGoPage');
}

function acoesGoPage(p) {
  acoesState.page = p;
  acoesRender();
}

/* ── Modal detalhe ───────────────────────────────────────────── */
function acoesShowDetail(id) {
  const a = acoesState.data.find(x => x.id === id);
  if (!a) return;
  const isAdmin = currentUser?.acesso === 'Administrador';

  document.getElementById('ac-modal-title').textContent = a.nome;
  document.getElementById('ac-modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Identificação</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Código</div><div class="detail-value">${a.codigo}</div></div>
        <div class="detail-item"><div class="detail-label">Tipo</div><div class="detail-value">${a.tipo}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(a.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Modalidade</div><div class="detail-value">${modalidadeBadge(a.modalidade)}</div></div>
        <div class="detail-item"><div class="detail-label">Área Demandante</div><div class="detail-value">${a.areaDemandante || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Escola Proponente</div><div class="detail-value">${a.escolaProponente || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Eixo/Área Temática</div><div class="detail-value">${a.eixo || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">N° de Módulos</div><div class="detail-value">${a.numModulos || '—'}</div></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Detalhamento Pedagógico</div>
      <div class="detail-grid">
        <div class="detail-item full"><div class="detail-label">Descrição</div><div class="detail-value">${a.descricao || '—'}</div></div>
        <div class="detail-item full"><div class="detail-label">Ementa</div><div class="detail-value">${a.ementa || '—'}</div></div>
        <div class="detail-item full"><div class="detail-label">Objetivo Geral</div><div class="detail-value">${a.objetivoGeral || '—'}</div></div>
        <div class="detail-item full"><div class="detail-label">Metodologia</div><div class="detail-value">${a.metodologia || '—'}</div></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Informações Operacionais</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Carga Horária</div><div class="detail-value fw-700">${a.cargaHoraria || 0}h</div></div>
        <div class="detail-item"><div class="detail-label">Público-Alvo</div><div class="detail-value">${a.publicoAlvo || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Nº de Vagas</div><div class="detail-value">${a.vagas || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Período</div><div class="detail-value">${a.periodo || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Local</div><div class="detail-value">${a.local || '—'}</div></div>
        <div class="detail-item"><div class="detail-label">Instrutor/Facilitador</div><div class="detail-value">${a.instrutor || '—'}</div></div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Certificação</div>
      <div class="detail-grid">
        <div class="detail-item full"><div class="detail-label">Certificação</div><div class="detail-value">${a.certificacao || '—'}</div></div>
      </div>
    </div>`;

  document.getElementById('ac-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('ac-modal')">Fechar</button>
    ${isAdmin ? `<button class="btn btn-primary" onclick="closeModal('ac-modal'); openAcaoForm('${a.id}')">
      <i class="fas fa-edit"></i> Editar
    </button>` : ''}`;

  openModal('ac-modal');
}

/* ── Formulário CRUD ─────────────────────────────────────────── */
function openAcaoForm(id = null) {
  acoesState.editId = id;
  const a = id ? acoesState.data.find(x => x.id === id) : null;
  const d = window.ESPEN_DATA || {};

  const sel = (arr, val) => arr.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');

  document.getElementById('ac-modal-title').textContent = id ? 'Editar Ação Educativa' : 'Nova Ação Educativa';
  document.getElementById('ac-modal-body').innerHTML = `
    <form id="ac-form">
      <div class="form-section">
        <div class="form-section-title">Identificação</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Código *</label>
            <input class="form-control" id="af-codigo" required value="${a?.codigo || 'ESPEN-' + new Date().getFullYear() + '-'}">
          </div>
          <div class="form-group">
            <label>Tipo *</label>
            <select class="form-control" id="af-tipo" required>
              <option value="">Selecione</option>
              ${['Curso','Programa','Workshop','Seminário','Palestra','Treinamento','Outro'].map(t => `<option value="${t}" ${t === a?.tipo ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group col-span-2">
            <label>Nome da Ação *</label>
            <input class="form-control" id="af-nome" required value="${a?.nome || ''}">
          </div>
          <div class="form-group">
            <label>Modalidade *</label>
            <select class="form-control" id="af-modalidade" required>
              <option value="">Selecione</option>
              ${sel(d.MODALIDADES || [], a?.modalidade)}
            </select>
          </div>
          <div class="form-group">
            <label>Status *</label>
            <select class="form-control" id="af-status" required>
              <option value="">Selecione</option>
              ${sel(d.STATUS_ACAO || [], a?.status)}
            </select>
          </div>
          <div class="form-group">
            <label>Área Demandante</label>
            <input class="form-control" id="af-demandante" value="${a?.areaDemandante || ''}">
          </div>
          <div class="form-group">
            <label>Escola Proponente</label>
            <select class="form-control" id="af-escola">
              <option value="">Selecione</option>
              ${sel(d.ESCOLAS || [], a?.escolaProponente)}
            </select>
          </div>
          <div class="form-group">
            <label>Eixo Funcional</label>
            <select class="form-control" id="af-eixo">
              <option value="">Selecione</option>
              ${sel(d.EIXOS || [], a?.eixo)}
            </select>
          </div>
          <div class="form-group">
            <label>Área Temática</label>
            <select class="form-control" id="af-area">
              <option value="">Selecione</option>
              ${sel(d.UNIDADES_TEMATICAS || [], a?.areaTematica)}
            </select>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Detalhamento Pedagógico</div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea class="form-control" id="af-descricao" rows="3">${a?.descricao || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Ementa</label>
          <textarea class="form-control" id="af-ementa" rows="3">${a?.ementa || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Objetivo Geral</label>
          <textarea class="form-control" id="af-objetivo" rows="2">${a?.objetivoGeral || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Metodologia</label>
          <textarea class="form-control" id="af-metodologia" rows="2">${a?.metodologia || ''}</textarea>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Informações Operacionais</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Carga Horária (h)</label>
            <input type="number" class="form-control" id="af-carga" min="0" value="${a?.cargaHoraria || ''}">
          </div>
          <div class="form-group">
            <label>Nº de Módulos</label>
            <input type="number" class="form-control" id="af-modulos" min="0" value="${a?.numModulos || ''}">
          </div>
          <div class="form-group">
            <label>Público-Alvo</label>
            <select class="form-control" id="af-publico">
              <option value="">Selecione</option>
              ${sel([...(d.CARGOS || []), 'Todos os Cargos'], a?.publicoAlvo)}
            </select>
          </div>
          <div class="form-group">
            <label>Nº de Vagas</label>
            <input type="number" class="form-control" id="af-vagas" min="0" value="${a?.vagas || ''}">
          </div>
          <div class="form-group">
            <label>Período</label>
            <input class="form-control" id="af-periodo" value="${a?.periodo || ''}" placeholder="DD/MM/AAAA – DD/MM/AAAA">
          </div>
          <div class="form-group">
            <label>Local</label>
            <input class="form-control" id="af-local" value="${a?.local || ''}">
          </div>
          <div class="form-group col-span-2">
            <label>Instrutor/Facilitador</label>
            <input class="form-control" id="af-instrutor" value="${a?.instrutor || ''}">
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Certificação</div>
        <div class="form-group">
          <label>Descrição da Certificação</label>
          <input class="form-control" id="af-cert" value="${a?.certificacao || ''}">
        </div>
      </div>
    </form>`;

  document.getElementById('ac-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('ac-modal')">Cancelar</button>
    <button class="btn btn-primary" onclick="saveAcao()">
      <i class="fas fa-save"></i> Salvar
    </button>`;

  openModal('ac-modal');
}

function saveAcao() {
  const fields = {
    codigo: document.getElementById('af-codigo')?.value.trim(),
    tipo:   document.getElementById('af-tipo')?.value,
    nome:   document.getElementById('af-nome')?.value.trim(),
    modalidade: document.getElementById('af-modalidade')?.value,
    status: document.getElementById('af-status')?.value,
    areaDemandante: document.getElementById('af-demandante')?.value.trim(),
    escolaProponente: document.getElementById('af-escola')?.value,
    eixo:   document.getElementById('af-eixo')?.value,
    areaTematica: document.getElementById('af-area')?.value,
    descricao: document.getElementById('af-descricao')?.value.trim(),
    ementa: document.getElementById('af-ementa')?.value.trim(),
    objetivoGeral: document.getElementById('af-objetivo')?.value.trim(),
    metodologia: document.getElementById('af-metodologia')?.value.trim(),
    cargaHoraria: parseInt(document.getElementById('af-carga')?.value) || 0,
    numModulos: parseInt(document.getElementById('af-modulos')?.value) || 0,
    publicoAlvo: document.getElementById('af-publico')?.value,
    vagas: parseInt(document.getElementById('af-vagas')?.value) || 0,
    periodo: document.getElementById('af-periodo')?.value.trim(),
    local:   document.getElementById('af-local')?.value.trim(),
    instrutor: document.getElementById('af-instrutor')?.value.trim(),
    certificacao: document.getElementById('af-cert')?.value.trim(),
    competenciasVinculadas: [],
  };

  if (!fields.codigo || !fields.nome || !fields.modalidade || !fields.status) {
    showToast('Preencha: Código, Nome, Modalidade e Status.', 'danger');
    return;
  }

  const acoes = JSON.parse(localStorage.getItem(LS_ACOES) || '[]');
  if (acoesState.editId) {
    const idx = acoes.findIndex(a => a.id === acoesState.editId);
    if (idx !== -1) { acoes[idx] = { ...acoes[idx], ...fields, updatedAt: Date.now() }; }
    logActivity('update', `Ação <strong>${fields.nome}</strong> atualizada.`);
    showToast('Ação atualizada!', 'success');
  } else {
    acoes.push({ id: generateId('acao'), ...fields, createdAt: Date.now(), updatedAt: Date.now() });
    logActivity('create', `Nova ação <strong>${fields.nome}</strong> cadastrada.`);
    showToast('Ação cadastrada!', 'success');
  }
  localStorage.setItem(LS_ACOES, JSON.stringify(acoes));
  closeModal('ac-modal');
  acoesLoad();
}

function deleteAcao(id) {
  const acoes = JSON.parse(localStorage.getItem(LS_ACOES) || '[]');
  const a = acoes.find(x => x.id === id);
  if (!a || !confirm(`Excluir a ação "${a.nome}"?`)) return;
  localStorage.setItem(LS_ACOES, JSON.stringify(acoes.filter(x => x.id !== id)));
  logActivity('delete', `Ação <strong>${a.nome}</strong> excluída.`);
  showToast('Ação excluída.', 'success');
  acoesLoad();
}

/* ── Export DOCX ─────────────────────────────────────────────── */
async function exportAcoesDOCX() {
  const lib = typeof docx !== 'undefined' ? docx : window.docx;
  if (!lib) { showToast('Biblioteca DOCX ainda carregando.', 'warning'); return; }
  const data = acoesState.filtered;
  if (!data.length) { showToast('Nenhuma ação para exportar.', 'warning'); return; }
  showToast(`Gerando DOCX com ${data.length} ações…`, 'info', 5000);

  const { Document, Packer, Paragraph, TextRun, PageBreak } = lib;

  const sections = [];
  data.forEach((a, i) => {
    if (i > 0) sections.push(new Paragraph({ children: [new PageBreak()] }));
    sections.push(
      new Paragraph({ children: [new TextRun({ text: `${a.codigo} – ${a.nome}`, bold: true, size: 26, color: '1a237e', font: 'Calibri' })] }),
      new Paragraph({ text: '' }),
      ...[
        ['Tipo', a.tipo], ['Modalidade', a.modalidade], ['Status', a.status],
        ['Área Demandante', a.areaDemandante], ['Escola Proponente', a.escolaProponente],
        ['Carga Horária', `${a.cargaHoraria}h`], ['Público-alvo', a.publicoAlvo],
        ['Vagas', a.vagas], ['Período', a.periodo], ['Local', a.local],
        ['Instrutor', a.instrutor], ['Descrição', a.descricao],
        ['Objetivo Geral', a.objetivoGeral], ['Certificação', a.certificacao],
      ].map(([label, val]) =>
        new Paragraph({ children: [
          new TextRun({ text: `${label}: `, bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: String(val || '—'), size: 20, font: 'Calibri' }),
        ] })
      )
    );
  });

  const doc = new Document({ sections: [{ children: sections }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ESPEN_Acoes_${Date.now()}.docx`; a.click();
  URL.revokeObjectURL(url);
  showToast(`DOCX gerado com ${data.length} ações!`, 'success');
}
