const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto para uso seguro em `innerHTML`. */
export function escapeHtmlStr(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE[ch]);
}

/** Escapa texto para uso em atributos HTML (=`escapeHtmlStr`; cobertura idêntica). */
export const escapeHtmlAttr = escapeHtmlStr;
