/**
 * Cliente HTTP da API ESPEN.
 *
 * Resolução do `API_BASE`:
 *   • localhost / 127.0.0.1 / file:// → API local em :8001/api
 *   • caso contrário → produção (Railway).
 * Pode ser sobrescrito via `window.ESPEN_API_BASE` (ex.: para apontar a um staging).
 */

const AUTH_TOKEN_KEY = 'espen_api_token';

function defaultApiBase() {
  if (typeof window !== 'undefined' && window.ESPEN_API_BASE) {
    return String(window.ESPEN_API_BASE).replace(/\/+$/, '');
  }
  if (typeof window === 'undefined') return '/api';
  const host = window.location.hostname;
  const localHosts = ['127.0.0.1', 'localhost', '0.0.0.0', ''];
  if (localHosts.includes(host)) return 'http://127.0.0.1:8001/api';
  return `${window.location.origin}/api`;
}

export const API_BASE = defaultApiBase();

export function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** True quando a API resolvida é a instância local (habilita fallback de senha em texto plano só em dev). */
export function isLocalDevApiHost() {
  try {
    const u = new URL(API_BASE, window.location.origin);
    const h = (u.hostname || '').toLowerCase();
    return h === '127.0.0.1' || h === 'localhost' || h === '0.0.0.0';
  } catch {
    return false;
  }
}

/**
 * Faz uma requisição HTTP autenticada e devolve o JSON parseado (ou `null` em 204).
 * Lança `Error` (com `.status`) em respostas não-2xx, com `detail` extraído quando disponível.
 */
export async function apiFetch(method, path, body = null, { useAuth = true } = {}) {
  const headers = {};
  const init = { method, headers };

  if (body != null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (useAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    let detail = `Erro na API (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && payload.detail) detail = payload.detail;
    } catch (_) {
      /* corpo não-JSON: mantém mensagem padrão */
    }
    const err = new Error(detail);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
