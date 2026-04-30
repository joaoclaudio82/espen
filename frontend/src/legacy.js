/**
 * legacy.js — code path completo do app (renderers, modais, exportações DOCX, moderação).
 *
 * Em refator subsequente este arquivo deve ser quebrado em `src/pages/*.js`. Por ora
 * permanece como um arquivo grande para manter paridade visual e funcional 1:1 com
 * o monólito anterior. Símbolos transversais (storage, auth, formatadores) já foram
 * extraídos e são consumidos via os imports abaixo.
 */
import { apiFetch, getToken } from './api/client.js';
import {
  STORAGE_KEYS,
  appendModeracaoItem,
  deleteStorage,
  getStorage,
  invalidateUsersCache,
  refetchKey,
  setStorage,
} from './api/storage.js';
import { sha256HexUtf8 } from './auth/crypto.js';
import { maskCPF, validateCPF } from './auth/cpf.js';
import {
  isAdminUser,
  isGestorUser,
  isSomenteLeitura,
  podeEditarDireto,
  usaFilaModeracao,
} from './auth/roles.js';
import {
  doLogin,
  doLogout,
  doRegister,
  getCurrentUser,
  setCurrentUser,
  showForgotPassword,
  switchAuthTab,
  updateSidebarUser,
  validateRegisterCPF,
} from './auth/session.js';
import { escapeHtmlStr } from './shared/escape.js';
import { fmtAE, genId, idEquals, normalizeActionCode } from './shared/format.js';
import { acaoEixoUnidadeFromLegacy, syncEixoTematicoLegado } from './shared/acoes-utils.js';
import { pdiNormalizePersistido, pdiUsaTrilhaLegado } from './shared/pdi-utils.js';
import { getPaginationButtons } from './shared/pagination.js';
import {
  MODERACAO_FIELD_LABELS,
  PDI_MODERACAO_LABELS_B1,
  PDI_MODERACAO_LABELS_B2,
  PDI_MODERACAO_LABELS_B3,
  buildMatrizModeracaoDiffBodyHtml,
  buildModeracaoDiffBodyHtml,
  getModeracaoResumo,
  getModeracaoTipoLabel,
  matrizStrippedForFieldDiff,
  moderacaoCollectObjectDiffs,
  moderacaoFmtDiffVal,
  moderacaoLabelForFieldPath,
  moderacaoMetaHeaderHtml,
  moderacaoPdiBlockTable,
  normalizeModeracaoPayload,
  pdiModeracaoLabelForPath,
  pushFilaModeracao,
} from './shared/moderacao.js';
import { showToast } from './shared/toast.js';
import {
  acoesFilter,
  acoesPage,
  acoesPerPage,
  acoesViewMode,
  charts,
  currentPage,
  gestorModeracaoHistoricoPage,
  gestorModeracaoHistoricoPerPage,
  matrizFilters,
  matrizPage,
  matrizPerPage,
  matrizSort,
  moderacaoHistoricoPage,
  moderacaoHistoricoPerPage,
  setAcoesFilter,
  setAcoesPage,
  setAcoesViewMode,
  setCharts,
  setCurrentPage,
  setGestorModeracaoHistoricoPage,
  setMatrizFilters,
  setMatrizPage,
  setMatrizSort,
  setModeracaoHistoricoPage,
} from './core/state.js';
import {
  closeModal,
  closeModalBtn,
  closeSidebar,
  destroyDashboardCharts,
  navigate,
  openModal,
  pageMap,
  toggleSidebar,
} from './router.js';

/* `currentUser` é mantido pelo módulo de auth — exposto aqui como propriedade dinâmica
 * para minimizar mudanças em ~5400 linhas que leem `currentUser.algo`. */
Object.defineProperty(globalThis, 'currentUser', {
  configurable: true,
  get: () => getCurrentUser(),
  set: (value) => setCurrentUser(value),
});

// ================================================================
// AUTH
// ================================================================

// Role helpers (isAdminUser etc.) → src/auth/roles.js
// pushFilaModeracao → src/shared/moderacao.js











// ================================================================
// NAVIGATION
// ================================================================

/**
 * Escopo da matriz usado nos gráficos do dashboard.
 * Se o filtro estiver em "filtrado" mas nenhuma ação tiver competências vinculadas,
 * usa fallback: todas as competências ativas (evita gráficos vazios enganosos).
 * @returns {{ escopo: array, matrizEscopoFallback: boolean }}
 */

// ================================================================
// GESTÃO DE USUÁRIOS
// ================================================================

// ================================================================
// EXPORTAÇÃO DOCX — HELPERS
// ================================================================

// Alias global para a lib (UMD expõe window.docx)

// ================================================================
// EXPOSIÇÃO PARA INLINE HANDLERS DO HTML
// ================================================================
//
// Templates renderizam `onclick="navigate('matriz')"` em escopo de documento.
// Como ES modules não vazam para `window`, ligamos as funções aqui no fim.
// O bridge das *variáveis de estado* mutáveis (matrizPage, matrizFilters, etc.)
// fica em `core/state.js`, populado quando aquele módulo é carregado.

Object.assign(globalThis, {
  // Constantes consumidas em onclick (ex.: importExcelData(STORAGE_KEYS.matriz))
  STORAGE_KEYS,
  // Navegação / chrome
  navigate, closeSidebar, toggleSidebar, openModal, closeModal, closeModalBtn,
  // Auth (re-expõe imports para inline handlers)
  doLogin, doRegister, doLogout, showForgotPassword, switchAuthTab,
  validateRegisterCPF, maskCPF,
  // Bootstrap helpers (consumidos pelo `main.js`)
  updateSidebarUser,
});
