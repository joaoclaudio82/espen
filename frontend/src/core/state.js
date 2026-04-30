/**
 * Estado mutável compartilhado entre páginas e inline handlers.
 *
 * Cada variável é exposta via `Object.defineProperty(globalThis, ...)` para que
 * `onclick="matrizPage = 2; renderMatrizTable()"` em templates HTML continue
 * funcionando — escopo de documento resolve pelo bridge.
 *
 * Os setters apenas mutam o `let` correspondente; getters retornam o valor atual.
 * Importadores podem usar diretamente os símbolos exportados (sem passar por window).
 */

// Página corrente (chave do `pageMap` em router.js).
export let currentPage = 'dashboard';
export function setCurrentPage(v) { currentPage = v; }

// Charts.js: registry de instâncias para `destroy()` ao trocar de página.
export let charts = {};
export function setCharts(v) { charts = v; }

// Matriz de competências
export let matrizPage = 1;
export function setMatrizPage(v) { matrizPage = v; }

export const matrizPerPage = 15;

export let matrizFilters = {
  search: '',
  categoria: '',
  cargo: '',
  eixo: '',
  unidade: '',
  complexidade: '',
  matriz: '',
  subcategoria: '',
  mostrarArquivados: false,
};
export function setMatrizFilters(v) { matrizFilters = v; }

export let matrizSort = { field: '', dir: 'asc' };
export function setMatrizSort(v) { matrizSort = v; }

// Ações educativas
export let acoesPage = 1;
export function setAcoesPage(v) { acoesPage = v; }

export const acoesPerPage = 15;

export let acoesFilter = {
  search: '',
  modalidade: '',
  status: '',
  competenciaMatrizId: '',
};
export function setAcoesFilter(v) { acoesFilter = v; }

export let acoesViewMode = 'cards';
export function setAcoesViewMode(v) { acoesViewMode = v; }

// Moderação — histórico (admin)
export let moderacaoHistoricoPage = 1;
export function setModeracaoHistoricoPage(v) { moderacaoHistoricoPage = v; }

export const moderacaoHistoricoPerPage = 15;

// Moderação — pendências do gestor
export let gestorModeracaoHistoricoPage = 1;
export function setGestorModeracaoHistoricoPage(v) { gestorModeracaoHistoricoPage = v; }

export const gestorModeracaoHistoricoPerPage = 15;

/**
 * Conecta cada variável mutável ao `globalThis` via getter/setter.
 * Templates HTML em escopo de documento veem o estado como global; reads/writes
 * são proxiados para os `let`s do módulo (modificações via inline-handler ficam
 * visíveis para code que importou a variável diretamente).
 */
function bridge(name, get, set) {
  Object.defineProperty(globalThis, name, { configurable: true, get, set });
}

bridge('currentPage', () => currentPage, (v) => { currentPage = v; });
bridge('charts', () => charts, (v) => { charts = v; });
bridge('matrizPage', () => matrizPage, (v) => { matrizPage = v; });
bridge('matrizFilters', () => matrizFilters, (v) => { matrizFilters = v; });
bridge('matrizSort', () => matrizSort, (v) => { matrizSort = v; });
bridge('acoesPage', () => acoesPage, (v) => { acoesPage = v; });
bridge('acoesFilter', () => acoesFilter, (v) => { acoesFilter = v; });
bridge('acoesViewMode', () => acoesViewMode, (v) => { acoesViewMode = v; });
bridge('moderacaoHistoricoPage', () => moderacaoHistoricoPage, (v) => { moderacaoHistoricoPage = v; });
bridge('gestorModeracaoHistoricoPage', () => gestorModeracaoHistoricoPage, (v) => { gestorModeracaoHistoricoPage = v; });
