/**
 * Helpers de papel/role do usuário logado.
 *
 * Resolvem-se contra o `currentUser` mantido por `session.js` — nunca leem
 * diretamente do `localStorage` ou de outro lugar, então mudanças de sessão
 * (login/logout) são refletidas automaticamente.
 */
import { getCurrentUser } from './session.js';

export function isAdminUser() {
  const u = getCurrentUser();
  return !!u && u.acesso === 'Administrador';
}

export function isGestorUser() {
  const u = getCurrentUser();
  return !!u && u.acesso === 'Gestor';
}

/** Leitura apenas: perfil Usuário ou Visitante (não Gestor nem Admin). */
export function isSomenteLeitura() {
  const u = getCurrentUser();
  if (!u) return true;
  const a = u.acesso;
  return a === 'Usuário' || a === 'Visitante';
}

/** Alterações aplicadas direto (sem fila): só administrador. */
export function podeEditarDireto() {
  return isAdminUser();
}

/**
 * Tudo que não é administrador (e pode editar) passa pela fila de aprovação —
 * matriz, ações educativas, trilhas e planos. Hoje corresponde ao perfil Gestor;
 * outros perfis com edição no futuro herdam a mesma regra.
 */
export function usaFilaModeracao() {
  if (isSomenteLeitura()) return false;
  if (isAdminUser()) return false;
  return true;
}
