/**
 * Utilitários compartilhados para Planos de Ensino.
 *
 * Usados por `pages/pdi.js` (form/render) e por `aplicarItemModeracao` +
 * `buildPdiModeracaoDiffBodyHtml` (moderação) — por isso ficam aqui em vez de
 * dentro do page module.
 */

/** Plano antigo só com trilha (sem acao_id): ainda exibido até ser regravado. */
export function pdiUsaTrilhaLegado(p) {
  return !!(p && p.trilha_id && !p.acao_id);
}

/**
 * Mantém só o que o fluxo atual de plano de ensino persiste (blocos + vínculos + datas).
 * Remove campos legados inúteis; com ação vinculada, remove `trilha_id` (migração do modelo antigo).
 */
export function pdiNormalizePersistido(p) {
  if (!p || typeof p !== 'object') return p;
  const o = { ...p };
  delete o.status;
  delete o.acoes_status;
  delete o.progresso;
  if (o.acao_id) delete o.trilha_id;
  return o;
}
