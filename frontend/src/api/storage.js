/**
 * Cache em memória das coleções remotas.
 *
 * Render functions chamam `getStorage` e esperam leitura síncrona — por isso o
 * cache é populado por `prefetchAll` no boot (login/restoreSession). Writes via
 * `setStorage` são otimistas: atualizam o cache imediatamente e disparam o PUT
 * em background (silenciosamente caem no localStorage se a API falhar).
 */
import { apiFetch, getToken } from './client.js';

export const STORAGE_KEYS = {
  users: 'espen_users',
  session: 'espen_session',
  matriz: 'espen_matriz',
  acoes: 'espen_acoes',
  trilhas: 'espen_trilhas',
  pdi: 'espen_pdi',
  dashboard: 'espen_dashboard',
  moderacao: 'espen_moderacao',
  moderacao_historico: 'espen_moderacao_historico',
};

const REMOTE_KEYS = [
  STORAGE_KEYS.matriz,
  STORAGE_KEYS.acoes,
  STORAGE_KEYS.trilhas,
  STORAGE_KEYS.pdi,
  STORAGE_KEYS.dashboard,
  STORAGE_KEYS.moderacao,
  STORAGE_KEYS.moderacao_historico,
];

const remoteCache = {};

/**
 * Invalida o cache de usuários e re-prefetcha em seguida — sem o refetch a próxima
 * leitura via `getStorage(STORAGE_KEYS.users)` retorna null e a tela parece vazia.
 */
export async function invalidateUsersCache() {
  remoteCache[STORAGE_KEYS.users] = null;
  try {
    localStorage.removeItem(STORAGE_KEYS.users);
  } catch (_) {
    /* localStorage indisponível: ignora */
  }
  if (getToken()) await prefetchUsers();
}

/**
 * Refetcha a chave da API e atualiza o cache.
 *
 * NÃO deleta o cache antes do fetch — isso evita uma race condition onde
 * múltiplos `refetchKey` concorrentes (não-awaitados) deixam o cache zerado
 * por uma janela curta, fazendo `getStorage` síncrono ler null no meio.
 * O cache antigo permanece servível até o novo dado chegar.
 */
export async function refetchKey(key) {
  if (!getToken()) {
    delete remoteCache[key];
    return;
  }
  if (key === STORAGE_KEYS.users) {
    await prefetchUsers();
  } else if (REMOTE_KEYS.includes(key)) {
    await prefetchKey(key);
  }
}

/**
 * Apenas marca a chave como stale (sem refetch). Use só quando souber que outro
 * código vai repopular logo em seguida; em geral prefira `refetchKey`.
 */
export function invalidateCacheKey(key) {
  delete remoteCache[key];
}

export function clearAllCache() {
  for (const key of Object.keys(remoteCache)) delete remoteCache[key];
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/** Leitura síncrona do cache (com fallback para localStorage para sessão e modo offline). */
export function getStorage(key) {
  if (key === STORAGE_KEYS.session) {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  if (remoteCache[key] !== undefined && remoteCache[key] !== null) {
    return deepClone(remoteCache[key]);
  }

  if (!getToken()) {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Escrita otimista: cache imediato + persistência assíncrona.
 *
 * Retorna a promise do PUT — callers que precisam ler de volta logo em seguida
 * (ex.: aprovar/recusar moderação que dispara um refetch logo após gravar)
 * devem `await` antes de continuar, ou um GET concorrente pode chegar ao
 * backend antes do PUT settler e devolver estado antigo.
 */
export function setStorage(key, data) {
  if (key === STORAGE_KEYS.session) {
    localStorage.setItem(key, JSON.stringify(data));
    return Promise.resolve();
  }

  remoteCache[key] = deepClone(data);

  if (!getToken()) {
    localStorage.setItem(key, JSON.stringify(data));
    return Promise.resolve();
  }

  if (key === STORAGE_KEYS.users) {
    console.warn('setStorage(users) não é suportado — use endpoints /api/users.');
    return Promise.resolve();
  }

  return apiFetch('PUT', `/storage/${key}`, { items: data }).catch((err) => {
    console.warn('Falha ao salvar na API, persistindo local:', err.message);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {
      /* quota cheia / modo privado: ignora */
    }
  });
}

/** Apaga todos os itens de uma chave de storage (admin only no backend). */
export async function deleteStorage(key) {
  await apiFetch('DELETE', `/storage/${key}`);
  remoteCache[key] = [];
}

/** Anexa um item à fila de moderação sem reescrever a coleção inteira. */
export async function appendModeracaoItem(item) {
  await apiFetch('POST', `/storage/${STORAGE_KEYS.moderacao}/append`, { item });
  const current = remoteCache[STORAGE_KEYS.moderacao] || [];
  remoteCache[STORAGE_KEYS.moderacao] = [...current, deepClone(item)];
}

async function prefetchUsers() {
  try {
    const users = await apiFetch('GET', '/users');
    remoteCache[STORAGE_KEYS.users] = users || [];
  } catch (err) {
    if (err.status === 403) {
      try {
        const dir = await apiFetch('GET', '/users/directory');
        remoteCache[STORAGE_KEYS.users] = dir || [];
      } catch (dirErr) {
        console.warn('Falha ao obter diretório de usuários:', dirErr.message);
        remoteCache[STORAGE_KEYS.users] = [];
      }
    } else {
      console.warn('Falha ao listar usuários:', err.message);
      remoteCache[STORAGE_KEYS.users] = [];
    }
  }
}

async function prefetchKey(key) {
  try {
    const response = await apiFetch('GET', `/storage/${key}`);
    remoteCache[key] = (response && response.items) || [];
  } catch (err) {
    console.warn(`Falha ao carregar ${key}:`, err.message);
    remoteCache[key] = [];
  }
}

/**
 * Carrega todas as coleções remotas em paralelo. Resolve quando todas estiverem
 * no cache, falhem ou retornem vazias — render functions já podem chamar `getStorage`.
 */
export async function prefetchAll() {
  if (!getToken()) return;
  await Promise.all([prefetchUsers(), ...REMOTE_KEYS.map(prefetchKey)]);
}
