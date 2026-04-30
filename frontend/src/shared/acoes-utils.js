/**
 * Utilitários para registros de Ações Educativas.
 *
 * Compatibilidade com formato legado:
 * - Registros antigos guardavam `eixo_tematico` ("Eixo / Unidade") combinado.
 * - Novos guardam `eixo` e `unidade` separados.
 *
 * Estas funções normalizam entre os dois formatos sem perder dados.
 */

/**
 * Resolve `{ eixo, unidade }` de um registro de ação preservando a separação:
 * - Se `eixo` ou `unidade` estiverem presentes → usa-os direto (mesmo se um vazio).
 * - Caso ambos vazios → faz fallback para parsear `eixo_tematico` (legado).
 *
 * Caia errado quando `eixo` está vazio mas `unidade` tem valor — antes a função
 * jogava `unidade` para `eixo` por reaproveitar o eixo_tematico (que era ===
 * unidade nesse caso); agora preserva.
 */
export function acaoEixoUnidadeFromLegacy(a) {
  if (!a) return { eixo: '', unidade: '' };
  const e = a.eixo != null ? String(a.eixo).trim() : '';
  const u = a.unidade != null ? String(a.unidade).trim() : '';
  if (e || u) return { eixo: e, unidade: u };
  const et = String(a.eixo_tematico || '').trim();
  if (!et) return { eixo: '', unidade: '' };
  const parts = et.split(/\s*\/\s*/);
  if (parts.length >= 2) return { eixo: parts[0].trim(), unidade: parts.slice(1).join(' / ').trim() };
  return { eixo: et, unidade: '' };
}

/** Concatena `eixo` + `unidade` no formato legado "Eixo / Unidade" — gravar e_tematico em paralelo. */
export function syncEixoTematicoLegado(eixo, unidade) {
  const e = String(eixo || '').trim();
  const u = String(unidade || '').trim();
  if (e && u) return `${e} / ${u}`;
  return e || u || '';
}
