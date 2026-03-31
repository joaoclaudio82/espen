/**
 * ESPEN – js/matriz.js
 * Módulo Matriz de Competências: listagem, filtros, paginação,
 * modal de detalhe, CRUD (admin), exportação CSV.
 */

/* ── Estado local ────────────────────────────────────────────── */
let matrizState = {
  data: [], filtered: [], page: 1, pageSize: 15,
  sort: { col: null, dir: 'asc' },
  filters: { search: '', categoria: '', cargo: '', eixo: '', unidade: '', complexidade: '', matriz: '' },
  editId: null,
};

/* ── Helpers de badge ────────────────────────────────────────── */
function complexBadge(v) {
  const map = { Básico: 'badge-info', Intermediário: 'badge-navy', Avançado: 'badge-gold' };
  return `<span class="badge ${map[v] || 'badge-gray'}">${v || '—'}</span>`;
}
function categBadge(v) {
  return `<span class="badge ${v === 'Especialista' ? 'badge-navy' : 'badge-success'}">${v || '—'}</span>`;
}
function matrizBadge(v) {
  const map = { '2017': 'badge-gray', '2023': 'badge-info', '2026': 'badge-gold' };
  return `<span class="badge ${map[v] || 'badge-gray'}">${v || '—'}</span>`;
}

/* ── Render principal ────────────────────────────────────────── */
function renderMatriz() {
  const data = window.ESPEN_DATA || {};
  const isAdmin = currentUser?.acesso === 'Administrador';

  // Topbar actions
  const ta = document.getElementById('topbar-actions');
  ta.innerHTML = `
    <button class="btn btn-ghost btn-sm" onclick="exportMatrizCSV()">
      <i class="fas fa-file-csv"></i> <span class="btn-label">CSV</span>
    </button>
    <button class="btn btn-ghost btn-sm" onclick="exportMatrizDOCX()">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
    ${isAdmin ? `<button class="btn btn-primary btn-sm" onclick="openMatrizForm()">
      <i class="fas fa-plus"></i> <span class="btn-label">Nova</span>
    </button>` : ''}`;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <h2>Matriz de Competências Nacionais – MCN 2026</h2>
        <p>602 competências distribuídas em 6 eixos funcionais</p>
      </div>
    </div>
    <div class="table-wrapper">
      <!-- Toolbar -->
      <div class="table-toolbar">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="mtz-search" placeholder="Buscar competência…" oninput="matrizFilter()">
        </div>
      </div>
      <!-- Filter bar -->
      <div class="filter-bar">
        <select class="filter-select" id="mtz-cat" onchange="matrizFilter()">
          <option value="">Todas as categorias</option>
          ${(data.CATEGORIAS || []).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="filter-select" id="mtz-cargo" onchange="matrizFilter()">
          <option value="">Todos os cargos</option>
          ${(data.CARGOS || []).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="filter-select" id="mtz-eixo" onchange="matrizFilter()">
          <option value="">Todos os eixos</option>
          ${(data.EIXOS || []).map(e => `<option value="${e}">${e}</option>`).join('')}
        </select>
        <select class="filter-select" id="mtz-compl" onchange="matrizFilter()">
          <option value="">Todas as complexidades</option>
          ${(data.TIPOLOGIAS_COMPLEXIDADE || []).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="filter-select" id="mtz-mtz" onchange="matrizFilter()">
          <option value="">Todas as matrizes</option>
          ${(data.MATRIZES || []).map(m => `<option value="${m}">MCN ${m}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="matrizClearFilters()">
          <i class="fas fa-times"></i> Limpar
        </button>
      </div>
      <!-- Table desktop -->
      <div class="table-scroll desktop-table">
        <table class="data-table" id="mtz-table">
          <thead>
            <tr>
              <th class="sortable" onclick="matrizSort('competencia')">#  Competência</th>
              <th class="sortable hide-mobile" onclick="matrizSort('categoria')">Categoria</th>
              <th class="sortable hide-mobile" onclick="matrizSort('cargo')">Cargo</th>
              <th class="sortable hide-mobile" onclick="matrizSort('eixo')">Eixo Funcional</th>
              <th class="sortable hide-mobile" onclick="matrizSort('tipologiaComplexidade')">Complexidade</th>
              <th class="hide-mobile">Matriz</th>
              ${isAdmin ? '<th style="width:80px">Ações</th>' : ''}
            </tr>
          </thead>
          <tbody id="mtz-tbody"></tbody>
        </table>
      </div>
      <!-- Cards mobile -->
      <div class="mobile-cards" id="mtz-mobile-cards"></div>
      <!-- Footer -->
      <div class="table-footer">
        <div class="table-info" id="mtz-info"></div>
        <div class="pagination" id="mtz-pagination"></div>
      </div>
    </div>
    <!-- Modal detalhe/form -->
    <div class="modal-overlay" id="mtz-modal" onclick="if(event.target===this) closeModal('mtz-modal')">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="mtz-modal-title">Detalhes da Competência</h3>
          <button class="modal-close" onclick="closeModal('mtz-modal')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body" id="mtz-modal-body"></div>
        <div class="modal-footer" id="mtz-modal-footer"></div>
      </div>
    </div>`;

  matrizLoad();
}

function matrizLoad() {
  matrizState.data     = JSON.parse(localStorage.getItem(LS_COMPETENCIAS) || '[]');
  matrizState.filtered = [...matrizState.data];
  matrizState.page     = 1;
  matrizRender();
}

function matrizFilter() {
  matrizState.filters.search      = document.getElementById('mtz-search')?.value.toLowerCase() || '';
  matrizState.filters.categoria   = document.getElementById('mtz-cat')?.value || '';
  matrizState.filters.cargo       = document.getElementById('mtz-cargo')?.value || '';
  matrizState.filters.eixo        = document.getElementById('mtz-eixo')?.value || '';
  matrizState.filters.complexidade = document.getElementById('mtz-compl')?.value || '';
  matrizState.filters.matriz       = document.getElementById('mtz-mtz')?.value || '';

  const f = matrizState.filters;
  matrizState.filtered = matrizState.data.filter(c => {
    if (f.search && !JSON.stringify(c).toLowerCase().includes(f.search)) return false;
    if (f.categoria   && c.categoria !== f.categoria) return false;
    if (f.cargo       && c.cargo !== f.cargo)         return false;
    if (f.eixo        && c.eixo !== f.eixo)           return false;
    if (f.complexidade && c.tipologiaComplexidade !== f.complexidade) return false;
    if (f.matriz      && c.matrizReferencia !== f.matriz) return false;
    return true;
  });
  matrizState.page = 1;
  matrizRender();
}

function matrizClearFilters() {
  ['mtz-search','mtz-cat','mtz-cargo','mtz-eixo','mtz-compl','mtz-mtz'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  matrizFilter();
}

function matrizSort(col) {
  if (matrizState.sort.col === col) {
    matrizState.sort.dir = matrizState.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    matrizState.sort.col = col;
    matrizState.sort.dir = 'asc';
  }
  matrizState.filtered.sort((a, b) => {
    const va = (a[col] || '').toLowerCase();
    const vb = (b[col] || '').toLowerCase();
    return matrizState.sort.dir === 'asc' ? va.localeCompare(vb, 'pt') : vb.localeCompare(va, 'pt');
  });
  matrizState.page = 1;
  matrizRender();
}

function matrizRender() {
  const { filtered, page, pageSize } = matrizState;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const isAdmin = currentUser?.acesso === 'Administrador';

  // Desktop tbody
  const tbody = document.getElementById('mtz-tbody');
  if (tbody) {
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state"><i class="fas fa-search"></i><h3>Nenhuma competência encontrada</h3></div>
      </td></tr>`;
    } else {
      tbody.innerHTML = slice.map((c, i) => `
        <tr class="clickable" onclick="matrizShowDetail('${c.id}')">
          <td>
            <div style="font-weight:600;color:var(--navy);font-size:13px;">${truncate(c.competencia, 55)}</div>
            <div style="font-size:11px;color:var(--gray-500);">${c.subcategoria || ''}</div>
          </td>
          <td class="hide-mobile">${categBadge(c.categoria)}</td>
          <td class="hide-mobile"><span style="font-size:12px;">${truncate(c.cargo, 25)}</span></td>
          <td class="hide-mobile"><span style="font-size:11px;color:var(--gray-600);">${c.eixo?.replace('Eixo ', 'E') || '—'}</span></td>
          <td class="hide-mobile">${complexBadge(c.tipologiaComplexidade)}</td>
          <td class="hide-mobile">${matrizBadge(c.matrizReferencia)}</td>
          ${isAdmin ? `<td onclick="event.stopPropagation()">
            <div style="display:flex;gap:4px;">
              <button class="btn-icon btn-sm" title="Editar" onclick="openMatrizForm('${c.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon btn-sm danger" title="Excluir" onclick="deleteCompetencia('${c.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>` : ''}
        </tr>`).join('');
    }
  }

  // Mobile cards
  const mobileCards = document.getElementById('mtz-mobile-cards');
  if (mobileCards) {
    mobileCards.innerHTML = slice.map(c => `
      <div class="activity-item" style="cursor:pointer;padding:12px 16px;" onclick="matrizShowDetail('${c.id}')">
        <div style="flex:1;">
          <div style="font-weight:600;color:var(--navy);font-size:13px;margin-bottom:4px;">${c.competencia}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${categBadge(c.categoria)} ${complexBadge(c.tipologiaComplexidade)} ${matrizBadge(c.matrizReferencia)}
          </div>
          <div style="font-size:11px;color:var(--gray-600);margin-top:4px;">${c.eixo || '—'}</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--gray-400);"></i>
      </div>`).join('') || `<div class="empty-state"><i class="fas fa-search"></i><p>Nenhuma competência encontrada</p></div>`;
  }

  // Info
  const info = document.getElementById('mtz-info');
  if (info) info.textContent = `Exibindo ${start + 1}–${Math.min(start + pageSize, total)} de ${total} registros filtrados (602 total)`;

  // Paginação
  const pag = document.getElementById('mtz-pagination');
  if (pag) pag.innerHTML = buildPagination(page, Math.ceil(total / pageSize), 'matrizGoPage');
}

function matrizGoPage(p) {
  matrizState.page = p;
  matrizRender();
}

/* ── Modal detalhe ───────────────────────────────────────────── */
function matrizShowDetail(id) {
  const c = matrizState.data.find(x => x.id === id);
  if (!c) return;
  const isAdmin = currentUser?.acesso === 'Administrador';

  document.getElementById('mtz-modal-title').textContent = 'Detalhe da Competência';
  document.getElementById('mtz-modal-body').innerHTML = `
    <div class="modal-section">
      <div class="modal-section-title">Identificação</div>
      <div class="detail-grid">
        <div class="detail-item full">
          <div class="detail-label">Competência</div>
          <div class="detail-value fw-700" style="font-size:15px;">${c.competencia}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Categoria</div>
          <div class="detail-value">${categBadge(c.categoria)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Subcategoria</div>
          <div class="detail-value">${c.subcategoria || '—'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Cargo</div>
          <div class="detail-value">${c.cargo}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Eixo Funcional</div>
          <div class="detail-value">${c.eixo}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Unidade Temática</div>
          <div class="detail-value">${c.unidadeTematica}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Matriz de Referência</div>
          <div class="detail-value">${matrizBadge(c.matrizReferencia)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Tipologia de Complexidade</div>
          <div class="detail-value">${complexBadge(c.tipologiaComplexidade)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Tipologia de Objetivo</div>
          <div class="detail-value">${c.tipologiaObjetivo || '—'}</div>
        </div>
      </div>
    </div>
    <div class="modal-section">
      <div class="modal-section-title">Conteúdo Educacional</div>
      <div class="detail-grid">
        <div class="detail-item full">
          <div class="detail-label">Conhecimento Crítico</div>
          <div class="detail-value">${c.conhecimentoCritico || '—'}</div>
        </div>
        <div class="detail-item full">
          <div class="detail-label">Objetivo de Aprendizagem</div>
          <div class="detail-value">${c.objetivoAprendizagem || '—'}</div>
        </div>
      </div>
    </div>`;

  document.getElementById('mtz-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('mtz-modal')">Fechar</button>
    ${isAdmin ? `<button class="btn btn-primary" onclick="closeModal('mtz-modal'); openMatrizForm('${c.id}')">
      <i class="fas fa-edit"></i> Editar
    </button>` : ''}`;

  openModal('mtz-modal');
}

/* ── Formulário CRUD ─────────────────────────────────────────── */
function openMatrizForm(id = null) {
  matrizState.editId = id;
  const c = id ? matrizState.data.find(x => x.id === id) : null;
  const data = window.ESPEN_DATA || {};

  const selectOpts = (arr, val) => arr.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');

  document.getElementById('mtz-modal-title').textContent = id ? 'Editar Competência' : 'Nova Competência';
  document.getElementById('mtz-modal-body').innerHTML = `
    <form id="mtz-form">
      <div class="form-section">
        <div class="form-section-title">Identificação</div>
        <div class="form-grid">
          <div class="form-group col-span-2">
            <label>Competência *</label>
            <input class="form-control" id="mf-competencia" required maxlength="300" value="${c?.competencia || ''}">
          </div>
          <div class="form-group">
            <label>Categoria *</label>
            <select class="form-control" id="mf-categoria" required>
              <option value="">Selecione</option>
              ${selectOpts(data.CATEGORIAS || [], c?.categoria)}
            </select>
          </div>
          <div class="form-group">
            <label>Subcategoria</label>
            <input class="form-control" id="mf-subcategoria" value="${c?.subcategoria || ''}">
          </div>
          <div class="form-group">
            <label>Cargo *</label>
            <select class="form-control" id="mf-cargo" required>
              <option value="">Selecione</option>
              ${selectOpts(data.CARGOS || [], c?.cargo)}
            </select>
          </div>
          <div class="form-group">
            <label>Eixo Funcional *</label>
            <select class="form-control" id="mf-eixo" required>
              <option value="">Selecione</option>
              ${selectOpts(data.EIXOS || [], c?.eixo)}
            </select>
          </div>
          <div class="form-group">
            <label>Unidade Temática</label>
            <select class="form-control" id="mf-unidade">
              <option value="">Selecione</option>
              ${selectOpts(data.UNIDADES_TEMATICAS || [], c?.unidadeTematica)}
            </select>
          </div>
          <div class="form-group">
            <label>Tipologia de Objetivo</label>
            <select class="form-control" id="mf-tipobj">
              <option value="">Selecione</option>
              ${selectOpts(data.TIPOLOGIAS_OBJETIVO || [], c?.tipologiaObjetivo)}
            </select>
          </div>
          <div class="form-group">
            <label>Tipologia de Complexidade *</label>
            <select class="form-control" id="mf-tipcompl" required>
              <option value="">Selecione</option>
              ${selectOpts(data.TIPOLOGIAS_COMPLEXIDADE || [], c?.tipologiaComplexidade)}
            </select>
          </div>
          <div class="form-group">
            <label>Matriz de Referência *</label>
            <select class="form-control" id="mf-matriz" required>
              <option value="">Selecione</option>
              ${(data.MATRIZES || []).map(m => `<option value="${m}" ${m === c?.matrizReferencia ? 'selected' : ''}>MCN ${m}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title">Conteúdo Educacional</div>
        <div class="form-group">
          <label>Conhecimento Crítico</label>
          <textarea class="form-control" id="mf-conhecimento" rows="3">${c?.conhecimentoCritico || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Objetivo de Aprendizagem</label>
          <textarea class="form-control" id="mf-objetivo" rows="3">${c?.objetivoAprendizagem || ''}</textarea>
        </div>
      </div>
    </form>`;

  document.getElementById('mtz-modal-footer').innerHTML = `
    <button class="btn btn-ghost" onclick="closeModal('mtz-modal')">Cancelar</button>
    <button class="btn btn-primary" onclick="saveCompetencia()">
      <i class="fas fa-save"></i> Salvar
    </button>`;

  openModal('mtz-modal');
}

function saveCompetencia() {
  const fields = {
    competencia: document.getElementById('mf-competencia')?.value.trim(),
    categoria:   document.getElementById('mf-categoria')?.value,
    subcategoria: document.getElementById('mf-subcategoria')?.value.trim(),
    cargo:       document.getElementById('mf-cargo')?.value,
    eixo:        document.getElementById('mf-eixo')?.value,
    unidadeTematica: document.getElementById('mf-unidade')?.value,
    tipologiaObjetivo: document.getElementById('mf-tipobj')?.value,
    tipologiaComplexidade: document.getElementById('mf-tipcompl')?.value,
    matrizReferencia: document.getElementById('mf-matriz')?.value,
    conhecimentoCritico: document.getElementById('mf-conhecimento')?.value.trim(),
    objetivoAprendizagem: document.getElementById('mf-objetivo')?.value.trim(),
  };

  if (!fields.competencia || !fields.categoria || !fields.cargo || !fields.eixo || !fields.tipologiaComplexidade || !fields.matrizReferencia) {
    showToast('Preencha todos os campos obrigatórios (*).', 'danger');
    return;
  }

  const comps = JSON.parse(localStorage.getItem(LS_COMPETENCIAS) || '[]');
  if (matrizState.editId) {
    const idx = comps.findIndex(c => c.id === matrizState.editId);
    if (idx !== -1) {
      comps[idx] = { ...comps[idx], ...fields, updatedAt: Date.now() };
      logActivity('update', `Competência <strong>${fields.competencia}</strong> atualizada.`);
      showToast('Competência atualizada!', 'success');
    }
  } else {
    const novo = { id: generateId('comp'), ...fields, createdAt: Date.now(), updatedAt: Date.now() };
    comps.push(novo);
    logActivity('create', `Nova competência <strong>${fields.competencia}</strong> cadastrada.`);
    showToast('Competência cadastrada!', 'success');
  }
  localStorage.setItem(LS_COMPETENCIAS, JSON.stringify(comps));
  closeModal('mtz-modal');
  matrizLoad();
}

function deleteCompetencia(id) {
  const comps = JSON.parse(localStorage.getItem(LS_COMPETENCIAS) || '[]');
  const c = comps.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Excluir a competência "${c.competencia}"?`)) return;
  localStorage.setItem(LS_COMPETENCIAS, JSON.stringify(comps.filter(x => x.id !== id)));
  logActivity('delete', `Competência <strong>${c.competencia}</strong> excluída.`);
  showToast('Competência excluída.', 'success');
  matrizLoad();
}

/* ── Exportação CSV ──────────────────────────────────────────── */
function exportMatrizCSV() {
  const data = matrizState.filtered;
  if (!data.length) { showToast('Nenhum registro para exportar.', 'warning'); return; }
  const header = ['ID', 'Competência', 'Categoria', 'Subcategoria', 'Cargo', 'Eixo Funcional', 'Unidade Temática', 'Conhecimento Crítico', 'Objetivo de Aprendizagem', 'Tipologia Objetivo', 'Tipologia Complexidade', 'Matriz Referência'];
  const rows = [header, ...data.map(c => [c.id, c.competencia, c.categoria, c.subcategoria, c.cargo, c.eixo, c.unidadeTematica, c.conhecimentoCritico, c.objetivoAprendizagem, c.tipologiaObjetivo, c.tipologiaComplexidade, c.matrizReferencia])];
  exportCSV(rows, `ESPEN_Matriz_${Date.now()}.csv`);
  logActivity('export', `Matriz exportada em CSV (${data.length} registros).`);
}

/* ── Exportação DOCX ─────────────────────────────────────────── */
async function exportMatrizDOCX() {
  const lib = typeof docx !== 'undefined' ? docx : window.docx;
  if (!lib) { showToast('Biblioteca DOCX ainda carregando, aguarde.', 'warning'); return; }
  const data = matrizState.filtered;
  if (!data.length) { showToast('Nenhum registro para exportar.', 'warning'); return; }
  showToast(`Gerando DOCX com ${data.length} competências…`, 'info', 5000);

  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, BorderStyle } = lib;

  const headerPar = new Paragraph({
    children: [
      new TextRun({ text: 'ESPEN – Matriz de Competências Nacionais', bold: true, size: 28, color: '1a237e', font: 'Calibri' }),
      new TextRun({ text: `\nMCN 2026 | Gerado em ${new Date().toLocaleDateString('pt-BR')} | ${data.length} competências`, size: 18, color: '666666', font: 'Calibri', break: 0 }),
    ],
  });

  const tableRows = [
    new TableRow({
      children: ['#', 'Competência', 'Categoria', 'Eixo Funcional', 'Complexidade', 'Matriz'].map(h =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: 'Calibri', color: 'ffffff' })] })],
          shading: { fill: '1a237e' },
        })
      ),
    }),
    ...data.map((c, i) => new TableRow({
      children: [
        String(i + 1), c.competencia, c.categoria, c.eixo?.replace('Eixo ', 'E') || '—', c.tipologiaComplexidade, c.matrizReferencia
      ].map(txt =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(txt || '—'), size: 16, font: 'Calibri' })] })],
          shading: i % 2 === 0 ? undefined : { fill: 'f8f9fa' },
        })
      ),
    })),
  ];

  const doc = new Document({
    sections: [{
      children: [
        headerPar,
        new Paragraph({ text: '' }),
        new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ESPEN_Matriz_${Date.now()}.docx`; a.click();
  URL.revokeObjectURL(url);
  showToast(`DOCX gerado com ${data.length} competências!`, 'success');
  logActivity('export', `Matriz exportada em DOCX (${data.length} registros).`);
}

/* ── Paginação helper ────────────────────────────────────────── */
function buildPagination(current, total, callbackFn) {
  if (total <= 1) return '';
  let html = '';
  html += `<button class="page-btn" onclick="${callbackFn}(${current - 1})" ${current === 1 ? 'disabled' : ''}>‹</button>`;

  let start = Math.max(1, current - 2);
  let end   = Math.min(total, current + 2);
  if (start > 1) html += `<button class="page-btn" onclick="${callbackFn}(1)">1</button>`;
  if (start > 2) html += `<span style="padding:0 4px;color:var(--gray-500)">…</span>`;

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="${callbackFn}(${i})">${i}</button>`;
  }

  if (end < total - 1) html += `<span style="padding:0 4px;color:var(--gray-500)">…</span>`;
  if (end < total)     html += `<button class="page-btn" onclick="${callbackFn}(${total})">${total}</button>`;
  html += `<button class="page-btn" onclick="${callbackFn}(${current + 1})" ${current === total ? 'disabled' : ''}>›</button>`;
  return html;
}
