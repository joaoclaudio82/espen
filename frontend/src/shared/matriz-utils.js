/**
 * Utilitários puros para registros da Matriz de Competências.
 * Usados por páginas que precisam consultar/filtrar matriz (dashboard, matriz).
 */

/** Competência arquivada — aceita boolean, 1/0 ou string vindos da API/JSON. */
export function isMatrizRegistroArquivado(r) {
  if (!r) return false;
  const a = r.arquivado;
  if (a === true || a === 1) return true;
  if (typeof a === 'string') {
    const s = a.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/** Chave normalizada do nome da competência (ignora capitalização e duplicatas por espaços). */
export function matrizChaveNomeCompetencia(r) {
  return String(r && r.competencia != null ? r.competencia : '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Quantidade de competências no escopo contando só nomes diferentes (campo `competencia`). */
export function countMatrizDistinctCompetenciaNames(rows) {
  const seen = new Set();
  (rows || []).forEach((r) => {
    const k = matrizChaveNomeCompetencia(r);
    if (k) seen.add(k);
  });
  return seen.size;
}
