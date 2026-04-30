/**
 * Página "Matriz de Competências" — listagem com filtros, paginação,
 * formulário modal, detalhe, arquivamento. Edições não-admin via fila.
 */
import { STORAGE_KEYS, getStorage, setStorage } from '../api/storage.js';
import { isAdminUser, isSomenteLeitura, usaFilaModeracao } from '../auth/roles.js';
import { getCurrentUser } from '../auth/session.js';
import {
  matrizFilters,
  matrizPage,
  matrizPerPage,
  setMatrizFilters,
  setMatrizPage,
} from '../core/state.js';
import { closeModalBtn, openModal } from '../router.js';
import { escapeHtmlStr } from '../shared/escape.js';
import { genId, idEquals } from '../shared/format.js';
import { isMatrizRegistroArquivado } from '../shared/matriz-utils.js';
import { pushFilaModeracao } from '../shared/moderacao.js';
import { getPaginationButtons } from '../shared/pagination.js';
import { showToast } from '../shared/toast.js';

export function renderMatriz() {
  const podeAlterar = !isSomenteLeitura();

  document.getElementById('topbar-actions').innerHTML = podeAlterar ? `
    <button class="btn btn-gold btn-sm" onclick="openMatrizForm()">
      <i class="fas fa-plus"></i> <span class="btn-label">Nova Competência</span>
    </button>
    ${isAdminUser() ? `<button class="btn btn-secondary btn-sm" onclick="importExcelData(STORAGE_KEYS.matriz)" title="Importar Excel">
      <i class="fas fa-file-import"></i> <span class="btn-label">Importar Excel</span>
    </button>` : ''}
    <button class="btn btn-secondary btn-sm" onclick="exportMatrizCSV()" title="Exportar CSV">
      <i class="fas fa-file-csv"></i> <span class="btn-label">CSV</span>
    </button>
    <button class="btn btn-secondary btn-sm" onclick="exportMatrizDOCX(this)" title="Exportar DOCX (Word)" style="color:#2b579a;">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
  ` : `
    <button class="btn btn-secondary btn-sm" onclick="exportMatrizCSV()" title="Exportar CSV">
      <i class="fas fa-file-csv"></i> <span class="btn-label">CSV</span>
    </button>
    <button class="btn btn-secondary btn-sm" onclick="exportMatrizDOCX(this)" title="Exportar DOCX" style="color:#2b579a;">
      <i class="fas fa-file-word"></i> <span class="btn-label">DOCX</span>
    </button>
  `;

  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Matriz de Competências Nacional — MCN 2026</div>
        <div class="section-sub">Gerencie todas as competências mapeadas para o sistema penal federal</div>
      </div>
    </div>
    <div class="filters-bar">
      <div class="search-box" style="flex:2;">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Buscar por competência, objetivo, conhecimento..." oninput="matrizFilters.search=this.value;matrizPage=1;renderMatrizTable()">
      </div>
      <div class="filter-group">
        <label>Categoria</label>
        <select onchange="matrizFilters.categoria=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todas</option><option>Especialista</option><option>Geral</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Subcategoria</label>
        <select onchange="matrizFilters.subcategoria=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todas</option>
          <option>Técnica/ Tecnológica</option>
          <option>Socioemocional/ Comportamental</option>
          <option>Sociojurídica e Direitos Fundamentais</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Cargo</label>
        <select onchange="matrizFilters.cargo=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todos</option>
          <option>Policial Penal</option>
          <option>Especialista Federal em Assistência à Execução Penal</option>
          <option>Técnico Federal de Apoio à Execução Penal</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Eixo Funcional</label>
        <select onchange="matrizFilters.eixo=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todos</option>
          <option>Operação e controle de Unidades Prisionais</option>
          <option>Policiamento Penal</option>
          <option>Governança do Sistema Penal</option>
          <option>Gestão dos Serviços Penais</option>
          <option>Neoprofessor dos Serviços Penais</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Complexidade</label>
        <select onchange="matrizFilters.complexidade=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todas</option><option>Básico</option><option>Intermediário</option><option>Avançado</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Matriz Ref.</label>
        <select onchange="matrizFilters.matriz=this.value;matrizPage=1;renderMatrizTable()">
          <option value="">Todas</option><option>2017</option><option>2023</option><option>2026</option>
        </select>
      </div>
      <div class="filter-group" style="min-width:180px;">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" ${matrizFilters.mostrarArquivados ? 'checked' : ''} onchange="matrizFilters.mostrarArquivados=this.checked;matrizPage=1;renderMatrizTable()" style="width:16px;height:16px;">
          Arquivadas
        </label>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="resetMatrizFilters()"><i class="fas fa-times"></i> Limpar</button>
    </div>
    <div class="table-card">
      <div id="matriz-table-content"></div>
    </div>
  `;
  renderMatrizTable();
}

export function resetMatrizFilters() {
  setMatrizFilters({ search: '', categoria: '', cargo: '', eixo: '', unidade: '', complexidade: '', matriz: '', subcategoria: '', mostrarArquivados: false });
  setMatrizPage(1);
  renderMatriz();
}

function getFilteredMatriz() {
  let data = getStorage(STORAGE_KEYS.matriz) || [];
  if (matrizFilters.mostrarArquivados) {
    data = data.filter((r) => isMatrizRegistroArquivado(r));
  } else {
    data = data.filter((r) => !isMatrizRegistroArquivado(r));
  }
  const { search, categoria, cargo, eixo, complexidade, matriz, subcategoria } = matrizFilters;
  if (search) {
    const s = search.toLowerCase();
    data = data.filter((r) => (r.competencia||'').toLowerCase().includes(s) || (r.conhecimento||'').toLowerCase().includes(s) || (r.objetivo||'').toLowerCase().includes(s) || (r.unidade||'').toLowerCase().includes(s));
  }
  if (categoria) data = data.filter((r) => r.categoria === categoria);
  if (subcategoria) data = data.filter((r) => r.subcategoria === subcategoria);
  if (cargo) data = data.filter((r) => r.cargo === cargo);
  if (eixo) data = data.filter((r) => r.eixo === eixo || r.eixo === eixo.replace('Operação e Controle', 'Operação e controle'));
  if (complexidade) data = data.filter((r) => r.tipologia_complexidade === complexidade);
  if (matriz) data = data.filter((r) => String(r.matriz) === String(matriz));
  return data;
}

/** Rótulo na tabela: reticências só quando o texto passa de maxLen. Conteúdo escapado. */
function matrizCellShortLabel(raw, maxLen) {
  const t = String(raw ?? '').trim();
  if (!t) return '—';
  if (t.length <= maxLen) return escapeHtmlStr(t);
  return `${escapeHtmlStr(t.substring(0, maxLen - 1))}…`;
}

export function renderMatrizTable() {
  const wrap = document.getElementById('matriz-table-content');
  if (!wrap) return;
  const data = getFilteredMatriz();
  const total = data.length;
  const totalPages = Math.ceil(total / matrizPerPage);
  if (matrizPage > totalPages && totalPages > 0) setMatrizPage(totalPages);
  const start = (matrizPage - 1) * matrizPerPage;
  const page = data.slice(start, start + matrizPerPage);
  const podeAlterar = !isSomenteLeitura();

  const complexColors = { Básico: 'green', Intermediário: 'gold', Avançado: 'blue' };
  const catColors = { Especialista: 'blue', Geral: 'gray' };

  let html = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th style="min-width:200px;">Competência</th>
            <th class="hide-mobile">Categoria</th>
            <th class="hide-mobile">Cargo</th>
            <th class="hide-mobile">Eixo Funcional</th>
            <th class="hide-mobile">Conhecimento Crítico</th>
            <th>Complexidade</th>
            <th class="hide-mobile">Matriz</th>
            ${podeAlterar ? '<th style="width:96px;">Ações</th>' : ''}
          </tr>
        </thead>
        <tbody>
  `;

  if (page.length === 0) {
    html += `<tr><td colspan="${podeAlterar ? 8 : 7}"><div class="empty-state"><i class="fas fa-search"></i><h3>Nenhum resultado</h3><p>Tente ajustar os filtros de busca</p></div></td></tr>`;
  } else {
    page.forEach((r) => {
      const cc = complexColors[r.tipologia_complexidade] || 'gray';
      const nc = catColors[r.categoria] || 'gray';
      html += `
        <tr onclick="viewMatrizDetail('${r.id}')" style="cursor:pointer;">
          <td>
            <span class="text-truncate fw-600" title="${r.competencia||''}" style="max-width:180px;">${r.competencia||'—'}</span>
            ${isMatrizRegistroArquivado(r) ? '<span class="badge badge-orange" style="margin-left:6px;">Arquivada</span>' : ''}
            <div class="show-mobile-only" style="display:none;margin-top:4px;display:none;">
              <span class="badge badge-${nc}" style="margin-right:4px;">${r.categoria||''}</span>
              <span class="badge badge-${cc}">${r.tipologia_complexidade||''}</span>
            </div>
          </td>
          <td class="hide-mobile"><span class="badge badge-${nc}">${r.categoria||'—'}</span></td>
          <td class="hide-mobile" style="font-size:12px;max-width:150px;" title="${escapeHtmlStr(r.cargo || '')}">${matrizCellShortLabel(r.cargo, 36)}</td>
          <td class="hide-mobile" style="font-size:12px;max-width:140px;" title="${escapeHtmlStr(r.eixo || '')}">${matrizCellShortLabel(r.eixo, 30)}</td>
          <td class="hide-mobile" style="font-size:12px;max-width:160px;" title="${r.conhecimento||''}">${(r.conhecimento||'—').substring(0,35)}${r.conhecimento&&r.conhecimento.length>35?'…':''}</td>
          <td><span class="badge badge-${cc}">${r.tipologia_complexidade||'—'}</span></td>
          <td class="hide-mobile"><span class="badge badge-purple">${r.matriz||'—'}</span></td>
          ${podeAlterar ? `<td onclick="event.stopPropagation()">
            <div style="display:flex;gap:4px;align-items:center;">
              <button class="btn btn-secondary btn-sm" onclick="editMatriz('${r.id}')" title="Editar" ${isMatrizRegistroArquivado(r) ? 'disabled' : ''}><i class="fas fa-edit"></i></button>
              <button class="btn btn-mustard btn-sm" onclick="deleteMatriz('${r.id}')" title="Arquivar competência" ${isMatrizRegistroArquivado(r) ? 'disabled' : ''}><i class="fas fa-archive"></i></button>
            </div>
          </td>` : ''}
        </tr>
      `;
    });
  }

  html += `</tbody></table></div>
    <div class="table-footer">
      <div class="page-info">Exibindo ${start + 1}–${Math.min(start + matrizPerPage, total)} de <strong>${total}</strong> registros</div>
      <div class="pagination">
        <button class="page-btn" onclick="matrizPage=Math.max(1,matrizPage-1);renderMatrizTable()" ${matrizPage<=1?'disabled':''}><i class="fas fa-chevron-left"></i></button>
        ${getPaginationButtons(matrizPage, totalPages, 'matrizPage', 'renderMatrizTable()')}
        <button class="page-btn" onclick="matrizPage=Math.min(${totalPages},matrizPage+1);renderMatrizTable()" ${matrizPage>=totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `;

  wrap.innerHTML = html;
}

export function viewMatrizDetail(id) {
  const data = getStorage(STORAGE_KEYS.matriz) || [];
  const r = data.find((x) => idEquals(x.id, id));
  if (!r) return;
  const body = `
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-label">Competência</div><div class="detail-value fw-600">${r.competencia||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Categoria</div><div class="detail-value">${r.categoria||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Subcategoria</div><div class="detail-value">${r.subcategoria||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Cargo</div><div class="detail-value">${r.cargo||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Eixo Funcional</div><div class="detail-value">${r.eixo||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Unidade Temática</div><div class="detail-value">${r.unidade||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Conhecimento Crítico</div><div class="detail-value">${r.conhecimento||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Tipologia do Objetivo</div><div class="detail-value">${r.tipologia_objetivo||'—'}</div></div>
      <div class="detail-field"><div class="detail-label">Tipologia de Complexidade</div><div class="detail-value"><span class="badge badge-${r.tipologia_complexidade==='Avançado'?'blue':r.tipologia_complexidade==='Básico'?'green':'gold'}">${r.tipologia_complexidade||'—'}</span></div></div>
      <div class="detail-field"><div class="detail-label">Matriz de Referência</div><div class="detail-value"><span class="badge badge-purple">${r.matriz||'—'}</span></div></div>
    </div>
    <div class="divider"></div>
    <div class="detail-field">
      <div class="detail-label">Objetivo de Aprendizagem</div>
      <div class="detail-value" style="line-height:1.6;">${r.objetivo||'—'}</div>
    </div>
    ${Array.isArray(r.historico) && r.historico.length ? `
    <div class="divider"></div>
    <div class="detail-field">
      <div class="detail-label">Histórico de alterações (${r.historico.length})</div>
      <div class="detail-value" style="font-size:12px;max-height:160px;overflow-y:auto;">
        ${r.historico.slice().reverse().slice(0, 12).map(h => `<div style="margin-bottom:8px;padding:8px;background:var(--gray-50);border-radius:6px;">
          <strong>${new Date(h.ts).toLocaleString('pt-BR')}</strong> — ${h.usuario || '—'} — ${h.acao || 'alteração'}
        </div>`).join('')}
      </div>
    </div>` : ''}
  `;
  openModal('Detalhe da Competência', body, '<button class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>', true);
}

export function openMatrizForm(id = null) {
  if (isSomenteLeitura()) return;
  const data = getStorage(STORAGE_KEYS.matriz) || [];
  const r = id ? data.find((x) => idEquals(x.id, id)) : null;
  if (id && r && isMatrizRegistroArquivado(r)) {
    showToast('Esta competência está arquivada e não pode ser editada.', 'info');
    return;
  }
  const v = r || {};
  const body = `
    <div class="form-grid">
      <div class="form-group form-full">
        <label>Competência (capacidades de/para) *</label>
        <textarea id="mf-competencia" rows="3">${v.competencia||''}</textarea>
      </div>
      <div class="form-group">
        <label>Categoria *</label>
        <select id="mf-categoria">
          <option value="">Selecione...</option>
          <option ${v.categoria==='Especialista'?'selected':''}>Especialista</option>
          <option ${v.categoria==='Geral'?'selected':''}>Geral</option>
        </select>
      </div>
      <div class="form-group">
        <label>Subcategoria *</label>
        <select id="mf-subcategoria">
          <option value="">Selecione...</option>
          <option ${v.subcategoria==='Técnica/ Tecnológica'?'selected':''}>Técnica/ Tecnológica</option>
          <option ${v.subcategoria==='Socioemocional/ Comportamental'?'selected':''}>Socioemocional/ Comportamental</option>
          <option ${v.subcategoria==='Sociojurídica e Direitos Fundamentais'?'selected':''}>Sociojurídica e Direitos Fundamentais</option>
        </select>
      </div>
      <div class="form-group">
        <label>Cargo *</label>
        <select id="mf-cargo">
          <option value="">Selecione...</option>
          <option ${v.cargo==='Policial Penal'?'selected':''}>Policial Penal</option>
          <option ${v.cargo==='Especialista Federal em Assistência à Execução Penal'?'selected':''}>Especialista Federal em Assistência à Execução Penal</option>
          <option ${v.cargo==='Técnico Federal de Apoio à Execução Penal'?'selected':''}>Técnico Federal de Apoio à Execução Penal</option>
        </select>
      </div>
      <div class="form-group">
        <label>Eixo Funcional</label>
        <select id="mf-eixo">
          <option value="">Selecione...</option>
          <option ${v.eixo==='Operação e controle de Unidades Prisionais'?'selected':''}>Operação e controle de Unidades Prisionais</option>
          <option ${v.eixo==='Policiamento Penal'?'selected':''}>Policiamento Penal</option>
          <option ${v.eixo==='Governança do Sistema Penal'?'selected':''}>Governança do Sistema Penal</option>
          <option ${v.eixo==='Gestão dos Serviços Penais'?'selected':''}>Gestão dos Serviços Penais</option>
          <option ${v.eixo==='Neoprofessor dos Serviços Penais'?'selected':''}>Neoprofessor dos Serviços Penais</option>
        </select>
      </div>
      <div class="form-group">
        <label>Unidade Temática</label>
        <input type="text" id="mf-unidade" value="${v.unidade||''}" placeholder="Ex: Educação e Cultura para as PPL">
      </div>
      <div class="form-group">
        <label>Conhecimento Crítico e para Prática</label>
        <input type="text" id="mf-conhecimento" value="${v.conhecimento||''}" placeholder="Ex: Acesso ao Lazer e Cultura">
      </div>
      <div class="form-group">
        <label>Tipologia do Objetivo</label>
        <select id="mf-tipobj">
          <option value="">Selecione...</option>
          ${['Prático-Tático','Prático-Estratégico','Prático-Operacional','Teórico-Conceitual','Teórico-Analítico','Teórico-Reflexivo-Crítico'].map(o=>`<option ${v.tipologia_objetivo===o?'selected':''}>${o}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Tipologia de Complexidade</label>
        <select id="mf-tipcomp">
          <option value="">Selecione...</option>
          <option ${v.tipologia_complexidade==='Básico'?'selected':''}>Básico</option>
          <option ${v.tipologia_complexidade==='Intermediário'?'selected':''}>Intermediário</option>
          <option ${v.tipologia_complexidade==='Avançado'?'selected':''}>Avançado</option>
        </select>
      </div>
      <div class="form-group">
        <label>Matriz de Referência</label>
        <select id="mf-matriz">
          <option value="">Selecione...</option>
          <option ${v.matriz==='2017'?'selected':''}>2017</option>
          <option ${v.matriz==='2023'?'selected':''}>2023</option>
          <option ${v.matriz==='2026'?'selected':''}>2026</option>
        </select>
      </div>
      <div class="form-group form-full">
        <label>Objetivo de Aprendizagem *</label>
        <textarea id="mf-objetivo" rows="4">${v.objetivo||''}</textarea>
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModalBtn()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveMatriz('${id||''}')"><i class="fas fa-save"></i> ${id ? 'Salvar Alterações' : 'Cadastrar Competência'}</button>
  `;
  openModal(id ? 'Editar Competência' : 'Nova Competência', body, footer, true);
}

export function editMatriz(id) { openMatrizForm(id); }

export function saveMatriz(id) {
  const currentUser = getCurrentUser();
  const data = getStorage(STORAGE_KEYS.matriz) || [];
  if (id) {
    const atual = data.find((x) => idEquals(x.id, id));
    if (atual && isMatrizRegistroArquivado(atual)) {
      showToast('Esta competência está arquivada e não pode ser alterada.', 'warning');
      closeModalBtn();
      return;
    }
  }
  const fields = {
    competencia: document.getElementById('mf-competencia').value.trim(),
    categoria: document.getElementById('mf-categoria').value,
    subcategoria: document.getElementById('mf-subcategoria').value,
    cargo: document.getElementById('mf-cargo').value,
    eixo: document.getElementById('mf-eixo').value,
    unidade: document.getElementById('mf-unidade').value.trim(),
    conhecimento: document.getElementById('mf-conhecimento').value.trim(),
    tipologia_objetivo: document.getElementById('mf-tipobj').value,
    tipologia_complexidade: document.getElementById('mf-tipcomp').value,
    matriz: document.getElementById('mf-matriz').value,
    objetivo: document.getElementById('mf-objetivo').value.trim(),
  };
  if (!fields.competencia || !fields.categoria || !fields.cargo || !fields.objetivo) {
    showToast('Preencha os campos obrigatórios (*)', 'warning'); return;
  }
  let registro;
  if (id) {
    const idx = data.findIndex((x) => idEquals(x.id, id));
    if (idx < 0) return;
    const anterior = JSON.parse(JSON.stringify(data[idx]));
    const hist = Array.isArray(anterior.historico) ? anterior.historico : [];
    hist.push({
      ts: Date.now(),
      usuario: currentUser.nome,
      acao: 'edição',
      estado_anterior: anterior,
    });
    registro = {
      ...anterior,
      ...fields,
      historico: hist.slice(-50),
      atualizado_em: new Date().toISOString(),
      atualizado_por: currentUser.nome,
    };
    if (usaFilaModeracao()) {
      pushFilaModeracao('matriz_upsert', { editId: id, registro });
      closeModalBtn();
      showToast('Alteração enviada para aprovação do administrador.', 'info');
      return;
    }
    data[idx] = registro;
  } else {
    registro = {
      id: genId(),
      ...fields,
      historico: [],
      criado_em: new Date().toISOString(),
      criado_por: currentUser.nome,
    };
    if (usaFilaModeracao()) {
      pushFilaModeracao('matriz_upsert', { editId: null, registro });
      closeModalBtn();
      showToast('Cadastro enviado para aprovação do administrador.', 'info');
      return;
    }
    data.push(registro);
  }
  setStorage(STORAGE_KEYS.matriz, data);
  closeModalBtn();
  showToast(id ? 'Competência atualizada!' : 'Competência cadastrada!', 'success');
  renderMatrizTable();
}

export function deleteMatriz(id) {
  const currentUser = getCurrentUser();
  const dataPre = getStorage(STORAGE_KEYS.matriz) || [];
  const rowPre = dataPre.find((x) => idEquals(x.id, id));
  if (rowPre && isMatrizRegistroArquivado(rowPre)) return;
  if (!confirm('Arquivar esta competência? Ela deixa de aparecer na lista principal, mas permanece no histórico.')) return;
  if (usaFilaModeracao()) {
    pushFilaModeracao('matriz_arquivar', { id });
    showToast('Solicitação de arquivamento enviada ao administrador.', 'info');
    renderMatrizTable();
    return;
  }
  const data = getStorage(STORAGE_KEYS.matriz) || [];
  const idx = data.findIndex((x) => idEquals(x.id, id));
  if (idx < 0) return;
  const anterior = JSON.parse(JSON.stringify(data[idx]));
  const hist = Array.isArray(anterior.historico) ? anterior.historico : [];
  hist.push({ ts: Date.now(), usuario: currentUser.nome, acao: 'arquivamento', estado_anterior: anterior });
  data[idx] = {
    ...anterior,
    arquivado: true,
    arquivado_em: new Date().toISOString(),
    arquivado_por: currentUser.nome,
    historico: hist.slice(-50),
  };
  setStorage(STORAGE_KEYS.matriz, data);
  showToast('Competência arquivada.', 'success');
  renderMatrizTable();
}

export function exportMatrizCSV() {
  const data = getFilteredMatriz();
  const headers = ['id','Competência','Categoria','Subcategoria','Cargo','Eixo Funcional','Unidade Temática','Conhecimento Crítico','Objetivo','Tipologia Objetivo','Tipologia Complexidade','Matriz'];
  const rows = data.map(r => [r.id,r.competencia,r.categoria,r.subcategoria,r.cargo,r.eixo,r.unidade,r.conhecimento,r.objetivo,r.tipologia_objetivo,r.tipologia_complexidade,r.matriz].map(v => `"${(v||'').replace(/"/g,'""')}"`));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'matriz_competencias_espen.csv'; a.click();
  showToast(`${data.length} registros exportados!`, 'success');
}

Object.assign(globalThis, {
  renderMatriz,
  renderMatrizTable,
  resetMatrizFilters,
  viewMatrizDetail,
  openMatrizForm,
  editMatriz,
  saveMatriz,
  deleteMatriz,
  exportMatrizCSV,
});
