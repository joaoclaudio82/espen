/** SHA-256 (hex minúsculo) da string em UTF-8 — formato enviado à API em vez do texto plano. */
export async function sha256HexUtf8(plain) {
  if (!plain) return '';
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Ambiente sem Web Crypto (use HTTPS ou localhost) para envio seguro da senha.');
  }
  const enc = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Hash determinístico simples — usado apenas para comparações locais legadas (não para auth). */
export function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16) + password.length.toString(16);
}
