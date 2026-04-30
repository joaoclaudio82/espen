/**
 * Renderiza os botões numerados de paginação (com elipses para listas grandes).
 *
 * @param {number} current — página corrente (1-based)
 * @param {number} total — total de páginas
 * @param {string} pageVar — nome da variável global a atualizar (ex.: `'matrizPage'`)
 * @param {string} callFn — chamada a executar após a mudança (ex.: `'renderMatrizTable()'`)
 */
export function getPaginationButtons(current, total, pageVar, callFn) {
  let btns = '';
  const pages = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }
  pages.forEach((p) => {
    if (p === '...') {
      btns += `<span style="padding:0 4px;color:var(--gray-500);">…</span>`;
    } else {
      btns += `<button class="page-btn ${p === current ? 'active' : ''}" onclick="${pageVar}=${p};${callFn}">${p}</button>`;
    }
  });
  return btns;
}
