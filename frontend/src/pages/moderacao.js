/**
 * Página "Moderação" — Aprovações (admin) e Pendências em validação (gestor).
 *
 * Inclui:
 *  - renderModeracao + renderModeracaoHistoricoTable: visão do administrador.
 *  - renderPendenciasGestorModeracao + renderGestorPendenciasHistoricoTable:
 *    visão do gestor (suas próprias submissões pendentes / decididas).
 *  - aprovarModeracaoItem / rejeitarModeracaoItem: aplica/recusa solicitação.
 *  - aplicarItemModeracao: aplicar mutação aprovada na coleção alvo
 *    (matriz/ações/trilhas/PDI).
 *  - verDetalheModeracaoPendente / verDetalheModeracaoHistorico: popups de
 *    detalhe (diff antes/depois ou tabela estruturada) + diff popups
 *    dedicados para matriz e PDI (o de matriz vem de shared/moderacao.js).
 *  - updateModeracaoNavBadge / updateGestorPendenciasNavBadge: contador na
 *    sidebar com refetch garantido.
 */
import { apiFetch } from '../api/client.js';
import { STORAGE_KEYS, getStorage, refetchKey, setStorage } from '../api/storage.js';
import { isAdminUser, isGestorUser, isSomenteLeitura, usaFilaModeracao } from '../auth/roles.js';
import { getCurrentUser } from '../auth/session.js';
import { currentPage, gestorModeracaoHistoricoPage, gestorModeracaoHistoricoPerPage, moderacaoHistoricoPage, moderacaoHistoricoPerPage, setGestorModeracaoHistoricoPage, setModeracaoHistoricoPage } from '../core/state.js';
import { closeModalBtn, openModal } from '../router.js';
import { escapeHtmlStr } from '../shared/escape.js';
import { genId, idEquals } from '../shared/format.js';
import { isMatrizRegistroArquivado } from '../shared/matriz-utils.js';
import {
  PDI_MODERACAO_LABELS_B1,
  PDI_MODERACAO_LABELS_B2,
  PDI_MODERACAO_LABELS_B3,
  buildMatrizModeracaoDiffBodyHtml,
  buildModeracaoDiffBodyHtml,
  getModeracaoResumo,
  getModeracaoTipoLabel,
  moderacaoCollectObjectDiffs,
  moderacaoFmtDiffVal,
  moderacaoMetaHeaderHtml,
  moderacaoPdiBlockTable,
  normalizeModeracaoPayload,
  pdiModeracaoLabelForPath,
} from '../shared/moderacao.js';
import { pdiNormalizePersistido } from '../shared/pdi-utils.js';
import { getPaginationButtons } from '../shared/pagination.js';
import { showToast } from '../shared/toast.js';

// Compat: invalidateStorageCacheKey é no-op no novo modelo (cache otimista do
// setStorage). Mantido para minimizar churn nos call sites.
const invalidateStorageCacheKey = () => {};

function buildPdiModeracaoDiffBodyHtml(payload) {
  const p = normalizeModeracaoPayload(payload);
  const reg = p.registro || {};
  const editId = p.editId;
  if (editId) {
    invalidateStorageCacheKey(STORAGE_KEYS.pdi);
    const pdis = getStorage(STORAGE_KEYS.pdi) || [];
    const prev = pdis.find((x) => idEquals(x.id, editId));
    if (!prev) {
      const regShow = pdiNormalizePersistido(reg);
      return `<p class="text-muted" style="font-size:13px;">Não foi possível localizar o plano atual na base (id: <code>${escapeHtmlStr(String(editId))}</code>). Estado <strong>proposto</strong> (JSON):</p><pre style="white-space:pre-wrap;font-size:12px;max-height:58vh;overflow:auto;margin:0;">${escapeHtmlStr(JSON.stringify(regShow, null, 2))}</pre>`;
    }
    const diffs = [];
    moderacaoCollectObjectDiffs('', pdiNormalizePersistido(prev), pdiNormalizePersistido(reg), diffs);
    if (!diffs.length) {
      return '<p class="text-muted" style="font-size:13px;margin:0;">Nenhuma diferença detectada entre o registro guardado e o proposto (conteúdo equivalente).</p>';
    }
    const rows = diffs
      .map(
        (d) => `
      <tr>
        <td style="vertical-align:top;font-weight:600;font-size:12px;color:var(--navy);padding:8px;border-bottom:1px solid var(--gray-100);word-break:break-word;">${escapeHtmlStr(pdiModeracaoLabelForPath(d.path))}</td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#fff5f5;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.antes))}</pre></td>
        <td style="vertical-align:top;font-size:12px;padding:8px;border-bottom:1px solid var(--gray-100);background:#f0fdf4;max-width:36%;word-break:break-word;"><pre style="margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:11px;">${escapeHtmlStr(moderacaoFmtDiffVal(d.depois))}</pre></td>
      </tr>`
      )
      .join('');
    return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;">Somente os campos abaixo <strong>diferem</strong> do plano atualmente guardado.</p>
      <div class="table-responsive" style="max-height:58vh;overflow:auto;border:1px solid var(--gray-200);border-radius:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:var(--gray-50);">
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Campo</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Antes (atual)</th>
            <th style="text-align:left;padding:8px 10px;font-size:12px;border-bottom:2px solid var(--gray-200);">Depois (proposto)</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  const regNovo = pdiNormalizePersistido(reg);
  return `<p style="font-size:13px;margin:0 0 10px;line-height:1.45;"><strong>Novo plano</strong> — conteúdo que será gravado se você aprovar.</p>
    <div style="max-height:58vh;overflow:auto;padding-right:4px;">
      ${moderacaoPdiBlockTable('Bloco 1 — Identificação da ação educativa', regNovo.plano_bloco1, PDI_MODERACAO_LABELS_B1)}
      ${moderacaoPdiBlockTable('Bloco 2 — Design de competências (MCN)', regNovo.plano_bloco2, PDI_MODERACAO_LABELS_B2)}
      ${moderacaoPdiBlockTable('Bloco 3 — Design da ação educativa', regNovo.plano_bloco3, PDI_MODERACAO_LABELS_B3)}
    </div>`;
}




window.openModeracaoMatrizDiffPopup = function (moderacaoItemId) {
  try {
    const q = getStorage(STORAGE_KEYS.moderacao) || [];
    const it = q.find((x) => idEquals(x.id, moderacaoItemId));
    if (!it || it.tipo !== 'matriz_upsert') {
      showToast('Solicitação não encontrada ou não é matriz de competências.', 'warning');
      return;
    }
    const payload = normalizeModeracaoPayload(it.payload);
    const titulo = payload.editId ? 'Alterações propostas — Matriz de competências' : 'Nova competência — conteúdo proposto';
    const body = buildMatrizModeracaoDiffBodyHtml(it.payload);
    const footer = `<button type="button" class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>`;
    openModal(titulo, body, footer, true, '');
  } catch (e) {
    console.error(e);
    showToast(e && e.message ? String(e.message) : 'Não foi possível montar o comparativo da matriz.', 'error');
  }
};

window.openModeracaoPdiDiffPopup = function (moderacaoItemId) {
  try {
    const q = getStorage(STORAGE_KEYS.moderacao) || [];
    const it = q.find((x) => idEquals(x.id, moderacaoItemId));
    if (!it || it.tipo !== 'pdi_upsert') {
      showToast('Solicitação não encontrada ou não é plano de ensino.', 'warning');
      return;
    }
    const payload = normalizeModeracaoPayload(it.payload);
    const titulo = payload.editId ? 'Alterações propostas — Plano de ensino' : 'Novo plano de ensino — conteúdo proposto';
    const body = buildPdiModeracaoDiffBodyHtml(it.payload);
    const footer = `<button type="button" class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>`;
    openModal(titulo, body, footer, true, '');
  } catch (e) {
    console.error(e);
    showToast(e && e.message ? String(e.message) : 'Não foi possível montar o comparativo.', 'error');
  }
};

function appendModeracaoHistorico(entry) {
  const arr = getStorage(STORAGE_KEYS.moderacao_historico) || [];
  arr.push({ ...entry, id: genId() });
  return setStorage(STORAGE_KEYS.moderacao_historico, arr);
}

async function updateModeracaoNavBadge() {
  const badge = document.getElementById('nav-moderacao-count');
  const nav = document.getElementById('nav-moderacao');
  if (!badge || !nav || !currentUser || currentUser.acesso !== 'Administrador') return;
  await refetchKey(STORAGE_KEYS.moderacao);
  const n = (getStorage(STORAGE_KEYS.moderacao) || []).length;
  badge.textContent = String(n);
  badge.style.display = n > 0 ? 'inline-block' : 'none';
}

async function updateGestorPendenciasNavBadge() {
  const badge = document.getElementById('nav-pendencias-gestor-count');
  const nav = document.getElementById('nav-pendencias-gestor');
  if (!badge || !nav || !currentUser || currentUser.acesso !== 'Gestor') return;
  await refetchKey(STORAGE_KEYS.moderacao);
  const n = (getStorage(STORAGE_KEYS.moderacao) || []).length;
  badge.textContent = String(n);
  badge.style.display = n > 0 ? 'inline-block' : 'none';
}


/**
 * Aplica um item da fila de moderação ao storage.
 * @returns {boolean} true se a alteração foi persistida com sucesso.
 */
function aplicarItemModeracao(item) {
  if (!item || !item.tipo) return false;
  const tipo = item.tipo;
  const payload = normalizeModeracaoPayload(item.payload);

  if (tipo === 'matriz_upsert') {
    invalidateStorageCacheKey(STORAGE_KEYS.matriz);
    const data = getStorage(STORAGE_KEYS.matriz) || [];
    const rec = payload.registro;
    if (!rec || typeof rec !== 'object') return false;
    if (payload.editId) {
      const idx = data.findIndex(x => idEquals(x.id, payload.editId));
      if (idx < 0) return false;
      data[idx] = rec;
    } else {
      data.push(rec);
    }
    setStorage(STORAGE_KEYS.matriz, data);
    return true;
  }
  if (tipo === 'matriz_arquivar') {
    invalidateStorageCacheKey(STORAGE_KEYS.matriz);
    const compId = payload.id ?? payload.matriz_id;
    if (compId == null || compId === '') return false;
    const data = getStorage(STORAGE_KEYS.matriz) || [];
    const idx = data.findIndex(x => idEquals(x.id, compId));
    if (idx < 0) return false;
    const anterior = JSON.parse(JSON.stringify(data[idx]));
    const hist = Array.isArray(anterior.historico) ? anterior.historico : [];
    hist.push({ ts: Date.now(), usuario: currentUser.nome, acao: 'arquivamento (aprovado)', estado_anterior: anterior });
    data[idx] = {
      ...anterior,
      arquivado: true,
      arquivado_em: new Date().toISOString(),
      arquivado_por: currentUser.nome,
      historico: hist.slice(-50),
    };
    setStorage(STORAGE_KEYS.matriz, data);
    return true;
  }
  if (tipo === 'acao_upsert') {
    invalidateStorageCacheKey(STORAGE_KEYS.acoes);
    const data = getStorage(STORAGE_KEYS.acoes) || [];
    const rec = payload.registro;
    if (!rec || typeof rec !== 'object') return false;
    if (payload.editId) {
      const idx = data.findIndex(x => idEquals(x.id, payload.editId));
      if (idx < 0) return false;
      data[idx] = { ...data[idx], ...rec };
    } else {
      data.push(rec);
    }
    setStorage(STORAGE_KEYS.acoes, data);
    return true;
  }
  if (tipo === 'acao_excluir') {
    invalidateStorageCacheKey(STORAGE_KEYS.acoes);
    if (payload.id == null || payload.id === '') return false;
    const data = (getStorage(STORAGE_KEYS.acoes) || []).filter(x => !idEquals(x.id, payload.id));
    setStorage(STORAGE_KEYS.acoes, data);
    return true;
  }
  if (tipo === 'trilha_upsert') {
    invalidateStorageCacheKey(STORAGE_KEYS.trilhas);
    const data = getStorage(STORAGE_KEYS.trilhas) || [];
    const rec = payload.registro;
    if (!rec || typeof rec !== 'object') return false;
    if (payload.editId) {
      const idx = data.findIndex(x => idEquals(x.id, payload.editId));
      if (idx < 0) return false;
      data[idx] = { ...data[idx], ...rec };
    } else {
      data.push(rec);
    }
    setStorage(STORAGE_KEYS.trilhas, data);
    return true;
  }
  if (tipo === 'trilha_excluir') {
    invalidateStorageCacheKey(STORAGE_KEYS.trilhas);
    if (payload.id == null || payload.id === '') return false;
    const data = (getStorage(STORAGE_KEYS.trilhas) || []).filter(x => !idEquals(x.id, payload.id));
    setStorage(STORAGE_KEYS.trilhas, data);
    return true;
  }
  if (tipo === 'pdi_upsert') {
    invalidateStorageCacheKey(STORAGE_KEYS.pdi);
    const data = getStorage(STORAGE_KEYS.pdi) || [];
    const rec = payload.registro;
    if (!rec || typeof rec !== 'object') return false;
    const recNorm = pdiNormalizePersistido(rec);
    if (payload.editId) {
      const idx = data.findIndex(x => idEquals(x.id, payload.editId));
      if (idx < 0) return false;
      data[idx] = pdiNormalizePersistido({ ...data[idx], ...recNorm });
    } else {
      data.push(recNorm);
    }
    setStorage(STORAGE_KEYS.pdi, data);
    return true;
  }
  if (tipo === 'pdi_excluir') {
    invalidateStorageCacheKey(STORAGE_KEYS.pdi);
    if (payload.id == null || payload.id === '') return false;
    const data = (getStorage(STORAGE_KEYS.pdi) || []).filter(x => !idEquals(x.id, payload.id));
    setStorage(STORAGE_KEYS.pdi, data);
    return true;
  }
  return false;
}

window.aprovarModeracaoItem = async function(mid) {
  if (!currentUser || currentUser.acesso !== 'Administrador') {
    showToast('Apenas administradores podem aprovar solicitações.', 'error');
    return;
  }
  const q = getStorage(STORAGE_KEYS.moderacao) || [];
  const item = q.find(x => idEquals(x.id, mid));
  if (!item) return;
  const aplicou = aplicarItemModeracao(item);
  if (!aplicou) {
    showToast('Não foi possível aplicar a alteração (registro não encontrado ou dados incompletos). Verifique se a competência ainda existe na matriz.', 'error');
    return;
  }
  // `aplicarItemModeracao` chamou `setStorage` na coleção alvo (matriz/ações/etc).
  // Aguardamos os dois PUTs (histórico + remoção da fila) antes de re-renderizar,
  // senão o `await refetchKey()` dentro de `renderModeracao` pode pegar estado
  // antigo no backend (race entre PUT em voo e GET de refetch).
  const historicoPromise = appendModeracaoHistorico({
    solicitacao_id: item.id,
    tipo: item.tipo,
    payload: JSON.parse(JSON.stringify(normalizeModeracaoPayload(item.payload))),
    solicitante_id: item.solicitante_id,
    solicitante_nome: item.solicitante_nome,
    solicitada_em: item.criado_em,
    status: 'aprovado',
    decidido_em: new Date().toISOString(),
    decidido_por_id: currentUser.id,
    decidido_por_nome: currentUser.nome,
    motivo_rejeicao: null,
  });
  const removalPromise = setStorage(STORAGE_KEYS.moderacao, q.filter(x => !idEquals(x.id, mid)));
  await Promise.all([historicoPromise, removalPromise]);
  showToast('Solicitação aplicada nos dados do sistema.', 'success');
  updateModeracaoNavBadge();
  if (currentPage === 'moderacao' && typeof renderModeracao === 'function') renderModeracao();
  else if (typeof globalThis.renderUsuarios === 'function') globalThis.renderUsuarios();
};

window.rejeitarModeracaoItem = async function(mid) {
  if (!currentUser || currentUser.acesso !== 'Administrador') {
    showToast('Apenas administradores podem recusar solicitações.', 'error');
    return;
  }
  if (!confirm('Recusar esta solicitação? A alteração não será aplicada.')) return;
  const motivo = (typeof window.prompt === 'function' ? window.prompt('Motivo da recusa (opcional):', '') : '') || '';
  const q = getStorage(STORAGE_KEYS.moderacao) || [];
  const item = q.find(x => idEquals(x.id, mid));
  if (!item) return;
  const historicoPromise = appendModeracaoHistorico({
    solicitacao_id: item.id,
    tipo: item.tipo,
    payload: JSON.parse(JSON.stringify(normalizeModeracaoPayload(item.payload))),
    solicitante_id: item.solicitante_id,
    solicitante_nome: item.solicitante_nome,
    solicitada_em: item.criado_em,
    status: 'rejeitado',
    decidido_em: new Date().toISOString(),
    decidido_por_id: currentUser.id,
    decidido_por_nome: currentUser.nome,
    motivo_rejeicao: motivo.trim() || null,
  });
  const removalPromise = setStorage(STORAGE_KEYS.moderacao, q.filter(x => !idEquals(x.id, mid)));
  await Promise.all([historicoPromise, removalPromise]);
  showToast('Solicitação recusada.', 'info');
  updateModeracaoNavBadge();
  if (currentPage === 'moderacao' && typeof renderModeracao === 'function') renderModeracao();
  else if (typeof globalThis.renderUsuarios === 'function') globalThis.renderUsuarios();
};



/** Detalhe estruturado para tipos sem diff dedicado (exclusões/arquivamentos sem registro). */
function buildModeracaoDetalheGenericoHtml(it) {
  const p = normalizeModeracaoPayload(it.payload);
  const reg = p.registro && typeof p.registro === 'object' ? p.registro : null;
  const editId = p.editId || p.id || p.matriz_id;

  // Para acao_upsert e trilha_upsert: mesmo diff antes/depois usado em matriz/pdi.
  if (it.tipo === 'acao_upsert') {
    return `${moderacaoMetaHeaderHtml(it)}${buildModeracaoDiffBodyHtml(it.payload, STORAGE_KEYS.acoes, 'Nova ação educativa')}`;
  }
  if (it.tipo === 'trilha_upsert') {
    return `${moderacaoMetaHeaderHtml(it)}${buildModeracaoDiffBodyHtml(it.payload, STORAGE_KEYS.trilhas, 'Nova trilha de aprendizagem')}`;
  }

  if (reg) {
    const titulo = editId ? 'Conteúdo proposto (edição)' : 'Conteúdo proposto (inclusão)';
    return `${moderacaoMetaHeaderHtml(it)}
      <div style="max-height:55vh;overflow:auto;padding-right:4px;">
        ${moderacaoPdiBlockTable(titulo, reg)}
      </div>`;
  }
  if (editId) {
    return `${moderacaoMetaHeaderHtml(it)}
      <div style="font-size:13px;line-height:1.5;">
        <p style="margin:0 0 8px;">Solicitação para <strong>${escapeHtmlStr(getModeracaoTipoLabel(it.tipo))}</strong>.</p>
        <p style="margin:0;color:var(--gray-600);">Identificador do registro afetado: <code>${escapeHtmlStr(String(editId))}</code></p>
      </div>`;
  }
  return `${moderacaoMetaHeaderHtml(it)}
    <p class="text-muted" style="font-size:13px;margin:0;">Solicitação sem dados estruturados adicionais.</p>`;
}

window.verDetalheModeracaoPendente = function(mid) {
  const q = getStorage(STORAGE_KEYS.moderacao) || [];
  const it = q.find(x => idEquals(x.id, mid));
  if (!it) {
    showToast('Solicitação não encontrada.', 'warning');
    return;
  }
  // Para matriz/pdi com editId existente, reusa o diff antes/depois (mais informativo).
  if (it.tipo === 'matriz_upsert') return window.openModeracaoMatrizDiffPopup(mid);
  if (it.tipo === 'pdi_upsert')    return window.openModeracaoPdiDiffPopup(mid);
  // Demais tipos: tabela estruturada de campos.
  const titulo = `Detalhe — ${getModeracaoTipoLabel(it.tipo)}`;
  const body = buildModeracaoDetalheGenericoHtml(it);
  const footer = `<button type="button" class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>`;
  openModal(titulo, body, footer, true, '');
};

window.verDetalheModeracaoHistorico = function(hid) {
  const arr = getStorage(STORAGE_KEYS.moderacao_historico) || [];
  const it = arr.find(x => x.id === hid);
  if (!it) {
    showToast('Registro não encontrado.', 'warning');
    return;
  }
  // Cabeçalho com decisão + reaproveitamento da view estruturada da solicitação original.
  const decisao = (it.status || '').toLowerCase();
  const badgeCls = decisao === 'aprovado' ? 'badge-success' : decisao === 'rejeitado' ? 'badge-danger' : 'badge-gray';
  const decididoEm = it.decidido_em ? new Date(it.decidido_em).toLocaleString('pt-BR') : '—';
  const motivo = it.motivo_rejeicao ? `<div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Motivo</strong>${escapeHtmlStr(it.motivo_rejeicao)}</div>` : '';
  const decisaoHeader = `
    <div style="background:var(--gray-50);border:1px solid var(--gray-200);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;display:grid;grid-template-columns:repeat(${motivo ? 3 : 2},minmax(0,1fr));gap:10px;">
      <div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Decisão</strong><span class="badge ${badgeCls}">${escapeHtmlStr(it.status || 'pendente')}</span></div>
      <div><strong style="color:var(--gray-600);display:block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Decidida por</strong>${escapeHtmlStr(it.decidido_por_nome || '—')} <span style="color:var(--gray-500);">— ${escapeHtmlStr(decididoEm)}</span></div>
      ${motivo}
    </div>`;
  // Reusa o builder genérico para mostrar conteúdo proposto (ou diff) sob o cabeçalho de decisão.
  const itemSolicitacao = {
    id: it.id,
    tipo: it.tipo,
    payload: it.payload,
    solicitante_nome: it.solicitante_nome,
    criado_em: it.solicitada_em || it.criado_em,
  };
  let solicitacaoBody;
  if (it.tipo === 'matriz_upsert' || it.tipo === 'pdi_upsert') {
    const builder = it.tipo === 'matriz_upsert' ? buildMatrizModeracaoDiffBodyHtml : buildPdiModeracaoDiffBodyHtml;
    solicitacaoBody = `${moderacaoMetaHeaderHtml(itemSolicitacao)}${builder(it.payload)}`;
  } else {
    solicitacaoBody = buildModeracaoDetalheGenericoHtml(itemSolicitacao);
  }
  openModal('Histórico de decisão', `${decisaoHeader}${solicitacaoBody}`, '<button class="btn btn-secondary" onclick="closeModalBtn()">Fechar</button>', true);
};



// ── Renderers (sidebar nav -> moderação) ────────────────────────────────────
function renderModeracaoHistoricoTable() {
  const wrap = document.getElementById('moderacao-historico-content');
  const sub = document.getElementById('moderacao-historico-sub');
  if (!wrap) return;

  const historico = [...(getStorage(STORAGE_KEYS.moderacao_historico) || [])].sort((a, b) => {
    const ta = new Date(a.decidido_em || a.solicitada_em || 0).getTime();
    const tb = new Date(b.decidido_em || b.solicitada_em || 0).getTime();
    return tb - ta;
  });
  const total = historico.length;

  if (sub) {
    sub.textContent = total === 0
      ? 'Nenhuma decisão registrada ainda.'
      : `${total} decisão(ões) · ordenadas do mais recente ao mais antigo · ${moderacaoHistoricoPerPage} por página`;
  }

  if (total === 0) {
    wrap.innerHTML = `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Decidido em</th>
              <th>Resultado</th>
              <th>Tipo</th>
              <th>Resumo</th>
              <th>Solicitante</th>
              <th>Administrador Responsável</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="6" style="padding:24px;text-align:center;color:var(--gray-500);">Nenhuma decisão registrada ainda.</td></tr>
          </tbody>
        </table>
      </div>`;
    return;
  }

  const totalPages = Math.ceil(total / moderacaoHistoricoPerPage);
  if (moderacaoHistoricoPage > totalPages) setModeracaoHistoricoPage(totalPages);
  if (moderacaoHistoricoPage < 1) setModeracaoHistoricoPage(1);
  const start = (moderacaoHistoricoPage - 1) * moderacaoHistoricoPerPage;
  const page = historico.slice(start, start + moderacaoHistoricoPerPage);

  const historicoRows = page.map(h => {
    const st = h.status === 'aprovado' ? 'green' : 'red';
    const stLabel = h.status === 'aprovado' ? 'Aprovado' : 'Recusado';
    const nomeDec = escapeHtmlStr(h.decidido_por_nome || '—');
    const nomeSol = escapeHtmlStr(h.solicitante_nome || '—');
    const tipoLabelEsc = escapeHtmlStr(getModeracaoTipoLabel(h.tipo));
    const resumoEsc = escapeHtmlStr(getModeracaoResumo({ tipo: h.tipo, payload: h.payload }));
    const motivo = h.motivo_rejeicao ? `<div style="font-size:11px;color:var(--gray-600);margin-top:4px;">Motivo: ${escapeHtmlStr(h.motivo_rejeicao)}</div>` : '';
    return `
      <tr onclick="verDetalheModeracaoHistorico('${String(h.id).replace(/'/g, "\\'")}')" style="cursor:pointer;">
        <td style="font-size:12px;white-space:nowrap;">${h.decidido_em ? new Date(h.decidido_em).toLocaleString('pt-BR') : '—'}</td>
        <td><span class="badge badge-${st}">${stLabel}</span></td>
        <td><span class="badge badge-gray">${tipoLabelEsc}</span></td>
        <td style="font-size:13px;max-width:380px;line-height:1.45;">${resumoEsc}${motivo}</td>
        <td style="font-size:13px;">${nomeSol}</td>
        <td style="font-size:13px;">${nomeDec}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Decidido em</th>
            <th>Resultado</th>
            <th>Tipo</th>
            <th>Resumo</th>
            <th>Solicitante</th>
            <th>Administrador Responsável</th>
          </tr>
        </thead>
        <tbody>${historicoRows}</tbody>
      </table>
    </div>
    <div class="table-footer">
      <div class="page-info">Exibindo ${start + 1}–${Math.min(start + moderacaoHistoricoPerPage, total)} de <strong>${total}</strong> registros</div>
      <div class="pagination">
        <button class="page-btn" onclick="moderacaoHistoricoPage=Math.max(1,moderacaoHistoricoPage-1);renderModeracaoHistoricoTable()" ${moderacaoHistoricoPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
        ${getPaginationButtons(moderacaoHistoricoPage, totalPages, 'moderacaoHistoricoPage', 'renderModeracaoHistoricoTable()')}
        <button class="page-btn" onclick="moderacaoHistoricoPage=Math.min(${totalPages},moderacaoHistoricoPage+1);renderModeracaoHistoricoTable()" ${moderacaoHistoricoPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `;
}

async function renderModeracao() {
  if (currentUser.acesso !== 'Administrador') {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h3>Acesso restrito</h3><p>Apenas administradores podem acessar aprovações e histórico.</p></div>`;
    return;
  }
  // Refetch da fila + histórico antes de renderizar — outros usuários podem ter
  // submetido alterações desde o login do admin. Sem isso, o cache fica defasado
  // e a tela mostra "Nenhuma solicitação" mesmo havendo pendências no backend.
  await Promise.all([
    refetchKey(STORAGE_KEYS.moderacao),
    refetchKey(STORAGE_KEYS.moderacao_historico),
  ]);
  document.getElementById('topbar-actions').innerHTML = '';
  updateModeracaoNavBadge();

  const fila = getStorage(STORAGE_KEYS.moderacao) || [];

  const pendentesRows = fila.length
    ? fila.map(it => {
        const nomeEsc = escapeHtmlStr(it.solicitante_nome || '—');
        const resumoEsc = escapeHtmlStr(getModeracaoResumo(it));
        const tipoLabelEsc = escapeHtmlStr(getModeracaoTipoLabel(it.tipo));
        const mid = JSON.stringify(String(it.id));
        return `
          <tr>
            <td style="font-size:12px;white-space:nowrap;">${new Date(it.criado_em).toLocaleString('pt-BR')}</td>
            <td><span class="badge badge-orange">${tipoLabelEsc}</span></td>
            <td style="font-size:13px;max-width:460px;line-height:1.45;"><div>${resumoEsc}</div></td>
            <td style="font-size:13px;">${nomeEsc}</td>
            <td style="white-space:nowrap;">
              <button type="button" class="btn btn-secondary btn-sm" style="width:7.25rem;box-sizing:border-box;margin-bottom:6px;" onclick='verDetalheModeracaoPendente(${mid})'><i class="fas fa-eye"></i> Detalhe</button><br>
              <button type="button" class="btn btn-primary btn-sm" style="width:7.25rem;box-sizing:border-box;" onclick="aprovarModeracaoItem('${it.id}')">Aprovar</button>
              <button type="button" class="btn btn-danger btn-sm" style="width:7.25rem;box-sizing:border-box;margin-left:8px;" onclick="rejeitarModeracaoItem('${it.id}')">Recusar</button>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--gray-500);">Nenhuma solicitação pendente.</td></tr>`;

  setModeracaoHistoricoPage(1);
  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Aprovações de alterações</div>
        <div class="section-sub">Decisões sobre mudanças enviadas por gestores; ao aprovar, a alteração é aplicada no sistema.</div>
      </div>
    </div>

    <div class="table-card" style="margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;">Pendentes</div>
        <div class="section-sub">${fila.length} solicitação(ões) na fila</div>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Solicitada em</th>
              <th>Tipo</th>
              <th>Resumo</th>
              <th>Solicitante</th>
              <th style="min-width:140px;">Ações</th>
            </tr>
          </thead>
          <tbody>${pendentesRows}</tbody>
        </table>
      </div>
    </div>

    <div class="table-card">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;">Histórico de decisões</div>
        <div class="section-sub" id="moderacao-historico-sub">Carregando…</div>
      </div>
      <div id="moderacao-historico-content"></div>
    </div>
  `;
  renderModeracaoHistoricoTable();
}

function renderGestorPendenciasHistoricoTable() {
  const wrap = document.getElementById('gestor-moderacao-historico-content');
  const sub = document.getElementById('gestor-moderacao-historico-sub');
  if (!wrap) return;
  invalidateStorageCacheKey(STORAGE_KEYS.moderacao_historico);
  const historico = [...(getStorage(STORAGE_KEYS.moderacao_historico) || [])].sort((a, b) => {
    const ta = new Date(a.decidido_em || a.solicitada_em || 0).getTime();
    const tb = new Date(b.decidido_em || b.solicitada_em || 0).getTime();
    return tb - ta;
  });
  const total = historico.length;
  if (sub) {
    sub.textContent =
      total === 0
        ? 'Nenhuma decisão registrada ainda sobre as suas solicitações.'
        : `${total} decisão(ões) · do mais recente ao mais antigo · ${gestorModeracaoHistoricoPerPage} por página`;
  }
  if (total === 0) {
    wrap.innerHTML = `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Decidido em</th>
              <th>Situação</th>
              <th>Tipo</th>
              <th>Resumo</th>
              <th>Decidido por</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="5" style="padding:24px;text-align:center;color:var(--gray-500);">Nenhuma decisão registrada ainda.</td></tr>
          </tbody>
        </table>
      </div>`;
    return;
  }
  const totalPages = Math.ceil(total / gestorModeracaoHistoricoPerPage);
  if (gestorModeracaoHistoricoPage > totalPages) setGestorModeracaoHistoricoPage(totalPages);
  if (gestorModeracaoHistoricoPage < 1) setGestorModeracaoHistoricoPage(1);
  const start = (gestorModeracaoHistoricoPage - 1) * gestorModeracaoHistoricoPerPage;
  const page = historico.slice(start, start + gestorModeracaoHistoricoPerPage);
  const historicoRows = page
    .map((h) => {
      const st = h.status === 'aprovado' ? 'green' : 'red';
      const stLabel = h.status === 'aprovado' ? 'Aprovado' : 'Recusado';
      const nomeDec = escapeHtmlStr(h.decidido_por_nome || '—');
      const tipoLabelEsc = escapeHtmlStr(getModeracaoTipoLabel(h.tipo));
      const resumoEsc = escapeHtmlStr(getModeracaoResumo({ tipo: h.tipo, payload: h.payload }));
      const motivo = h.motivo_rejeicao
        ? `<div style="font-size:11px;color:var(--gray-600);margin-top:4px;">Motivo: ${escapeHtmlStr(h.motivo_rejeicao)}</div>`
        : '';
      const hid = String(h.id).replace(/'/g, "\\'");
      return `
      <tr onclick="verDetalheModeracaoHistorico('${hid}')" style="cursor:pointer;">
        <td style="font-size:12px;white-space:nowrap;">${h.decidido_em ? new Date(h.decidido_em).toLocaleString('pt-BR') : '—'}</td>
        <td><span class="badge badge-${st}">${stLabel}</span></td>
        <td><span class="badge badge-gray">${tipoLabelEsc}</span></td>
        <td style="font-size:13px;max-width:380px;line-height:1.45;">${resumoEsc}${motivo}</td>
        <td style="font-size:13px;">${nomeDec}</td>
      </tr>`;
    })
    .join('');
  wrap.innerHTML = `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Decidido em</th>
            <th>Situação</th>
            <th>Tipo</th>
            <th>Resumo</th>
            <th>Decidido por</th>
          </tr>
        </thead>
        <tbody>${historicoRows}</tbody>
      </table>
    </div>
    <div class="table-footer">
      <div class="page-info">Exibindo ${start + 1}–${Math.min(start + gestorModeracaoHistoricoPerPage, total)} de <strong>${total}</strong> registros</div>
      <div class="pagination">
        <button class="page-btn" onclick="gestorModeracaoHistoricoPage=Math.max(1,gestorModeracaoHistoricoPage-1);renderGestorPendenciasHistoricoTable()" ${gestorModeracaoHistoricoPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
        ${getPaginationButtons(gestorModeracaoHistoricoPage, totalPages, 'gestorModeracaoHistoricoPage', 'renderGestorPendenciasHistoricoTable()')}
        <button class="page-btn" onclick="gestorModeracaoHistoricoPage=Math.min(${totalPages},gestorModeracaoHistoricoPage+1);renderGestorPendenciasHistoricoTable()" ${gestorModeracaoHistoricoPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>
  `;
}

async function renderPendenciasGestorModeracao() {
  if (currentUser.acesso !== 'Gestor') {
    document.getElementById('page-content').innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h3>Acesso restrito</h3><p>Esta área é exclusiva do perfil gestor.</p></div>`;
    return;
  }
  document.getElementById('topbar-actions').innerHTML = '';
  // Refetch para refletir aprovações/recusas que o admin tenha aplicado.
  await Promise.all([
    refetchKey(STORAGE_KEYS.moderacao),
    refetchKey(STORAGE_KEYS.moderacao_historico),
  ]);
  updateGestorPendenciasNavBadge();

  const fila = getStorage(STORAGE_KEYS.moderacao) || [];
  const pendentesRows = fila.length
    ? fila
        .map((it) => {
          const resumoEsc = escapeHtmlStr(getModeracaoResumo(it));
          const tipoLabelEsc = escapeHtmlStr(getModeracaoTipoLabel(it.tipo));
          const mid = JSON.stringify(String(it.id));
          return `
          <tr>
            <td style="font-size:12px;white-space:nowrap;">${new Date(it.criado_em).toLocaleString('pt-BR')}</td>
            <td><span class="badge badge-orange">${tipoLabelEsc}</span></td>
            <td><span class="badge badge-gray">Aguardando decisão</span></td>
            <td style="font-size:13px;max-width:460px;line-height:1.45;"><div>${resumoEsc}</div></td>
            <td style="white-space:nowrap;">
              <button type="button" class="btn btn-secondary btn-sm" onclick='verDetalheModeracaoPendente(${mid})'><i class="fas fa-eye"></i> Detalhe</button>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--gray-500);">Nenhuma solicitação sua aguardando validação do administrador.</td></tr>`;

  setGestorModeracaoHistoricoPage(1);
  document.getElementById('page-content').innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Pendências em validação</div>
        <div class="section-sub">Solicitações que você enviou para aprovação do administrador e o histórico de decisões já tomadas.</div>
      </div>
    </div>

    <div class="table-card" style="margin-bottom:20px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;">Aguardando o administrador</div>
        <div class="section-sub">${fila.length} solicitação(ões) pendente(s)</div>
      </div>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Enviada em</th>
              <th>Tipo</th>
              <th>Situação</th>
              <th>Resumo</th>
              <th style="min-width:120px;">Ações</th>
            </tr>
          </thead>
          <tbody>${pendentesRows}</tbody>
        </table>
      </div>
    </div>

    <div class="table-card">
      <div style="padding:16px 20px;border-bottom:1px solid var(--gray-100);">
        <div class="section-title" style="font-size:16px;">Histórico (decididas)</div>
        <div class="section-sub" id="gestor-moderacao-historico-sub">Carregando…</div>
      </div>
      <div id="gestor-moderacao-historico-content"></div>
    </div>
  `;
  renderGestorPendenciasHistoricoTable();
}

Object.assign(globalThis, {
  renderModeracao,
  renderModeracaoHistoricoTable,
  renderPendenciasGestorModeracao,
  renderGestorPendenciasHistoricoTable,
  updateModeracaoNavBadge,
  updateGestorPendenciasNavBadge,
  aplicarItemModeracao,
  appendModeracaoHistorico,
  buildPdiModeracaoDiffBodyHtml,
  buildModeracaoDetalheGenericoHtml,
  // window.openModeracaoMatrizDiffPopup / openModeracaoPdiDiffPopup /
  // verDetalheModeracaoPendente / verDetalheModeracaoHistorico já são `window.X = …`
  // dentro do módulo (não precisam de Object.assign).
});
