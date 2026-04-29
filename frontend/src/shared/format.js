/** Identificador local: prefixo de tempo + sufixo aleatório. */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Comparação de ids segura entre tipos (string/número/UUID/Excel). */
export function idEquals(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** Normaliza códigos de ação para comparação consistente (Excel × cadastro). */
export function normalizeActionCode(s) {
  return String(s || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Formata valor textual: vazio/`null` → `'-'`. */
export function fmtAE(v) {
  if (v == null) return '-';
  const s = String(v).trim();
  return s === '' ? '-' : s;
}
