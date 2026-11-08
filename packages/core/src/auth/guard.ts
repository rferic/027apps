/**
 * Authorization guard: scopes by action with an allowlist per credential
 * (ADR 0004).
 *
 * A session caller's role maps to a fixed scope set. Machine credentials get a
 * closed allowlist: a service key is bounded by its `role_cap`, while a
 * delegated key always acts as a `user` — its stored `role_cap` (if any) is
 * ignored at runtime, so it can never widen into administration. Any missing
 * scope → 403 `insufficient_scope`, without enumerating the resource; anon →
 * 401 `unauthorized`.
 */

import { DomainError } from '../errors';
import type { Caller } from '../api/types';

const PROFILE_SCOPES = ['profile:read', 'profile:write'] as const;
const DEVICE_SCOPES = ['devices:read', 'devices:write', 'devices:revoke'] as const;
const API_KEY_SCOPES = ['api_keys:read', 'api_keys:write', 'api_keys:revoke'] as const;

const USER_SCOPES = [
  ...PROFILE_SCOPES,
  'currencies:read',
  ...DEVICE_SCOPES,
  'modules:read',
] as const;

const ADMIN_SCOPES = [
  ...USER_SCOPES,
  'users:read',
  'users:write',
  'roles:assign',
  'user_categories:read',
  'user_categories:write',
  'modules:manage',
  'modules:grant',
  'invitations:read',
  'invitations:write',
  'settings:read',
  'settings:write',
  'currencies:write',
] as const;

const SUPER_ADMIN_SCOPES = [...ADMIN_SCOPES, 'users:deactivate'] as const;

/**
 * Session roles keep `api_keys:*`: the mobile app manages its own keys with
 * the user session. It grants no administration by itself.
 */
const SESSION_SCOPES: Record<'super_admin' | 'admin' | 'user', readonly string[]> = {
  super_admin: [...SUPER_ADMIN_SCOPES, ...API_KEY_SCOPES],
  admin: [...ADMIN_SCOPES, ...API_KEY_SCOPES],
  user: [...USER_SCOPES, ...API_KEY_SCOPES],
};

/**
 * Delegated keys: a closed allowlist that never includes administration. A
 * delegated key acts for its owner but only as a plain user. Its optional
 * module scopes are validated against the owner's `user_modules` grants when
 * the key is created or edited; there is no per-request module guard yet (that
 * check arrives with the module endpoints).
 */
export const DELEGATED_SCOPES = [
  ...PROFILE_SCOPES,
  'currencies:read',
  ...DEVICE_SCOPES,
  'modules:read',
  ...API_KEY_SCOPES,
  'users:read',
  'user_categories:read',
] as const;

/**
 * Service keys: administration without personal data or devices. The cap is
 * blast radius, not a role: `users:deactivate` and `maintenance:run` stay on
 * the super_admin cap only. No `api_keys:*`: a credential must not mint or
 * manage credentials, so key management stays on human sessions.
 */
const SERVICE_ADMIN_SCOPES = [
  'currencies:read',
  'currencies:write',
  'modules:read',
  'modules:manage',
  'modules:grant',
  'users:read',
  'users:write',
  'roles:assign',
  'user_categories:read',
  'user_categories:write',
  'invitations:read',
  'invitations:write',
  'settings:read',
  'settings:write',
] as const;

const SERVICE_SUPER_ADMIN_SCOPES = [
  ...SERVICE_ADMIN_SCOPES,
  'users:deactivate',
  'maintenance:run',
] as const;

export const MACHINE_SCOPES = {
  delegated: DELEGATED_SCOPES,
  service: {
    admin: SERVICE_ADMIN_SCOPES,
    super_admin: SERVICE_SUPER_ADMIN_SCOPES,
  },
} as const;

const SERVICE_SCOPES: Record<'admin' | 'super_admin', readonly string[]> = MACHINE_SCOPES.service;

/**
 * Namespaces the Core owns. A `<namespace>:read|read_write` scope outside this
 * set belongs to an installed module and is only accepted for delegated keys.
 */
const CORE_NAMESPACES: ReadonlySet<string> = new Set([
  'api_keys',
  'currencies',
  'devices',
  'invitations',
  'maintenance',
  'modules',
  'profile',
  'roles',
  'settings',
  'user_categories',
  'users',
]);

const MODULE_SCOPE = /^([a-z0-9][a-z0-9_-]{0,63}):(read|read_write)$/;

export function isModuleScope(scope: string): boolean {
  const match = MODULE_SCOPE.exec(scope);
  return match !== null && !CORE_NAMESPACES.has(match[1]!);
}

/** Scopes a caller can actually use, after the allowlist for its credential. */
export function effectiveScopes(caller: Caller): readonly string[] {
  if (caller.kind === 'anon') return [];
  if (caller.kind === 'session') return SESSION_SCOPES[caller.role];
  if (caller.kind === 'service') {
    return caller.scopes.filter((scope) => SERVICE_SCOPES[caller.roleCap].includes(scope));
  }
  // A delegated caller is always a plain user: roleCap is deliberately unused.
  return caller.scopes.filter(
    (scope) => (DELEGATED_SCOPES as readonly string[]).includes(scope) || isModuleScope(scope),
  );
}

export function authorize(caller: Caller, scopes: readonly string[]): Caller {
  if (caller.kind === 'anon') {
    throw new DomainError('unauthorized');
  }

  const available = effectiveScopes(caller);
  const missing = scopes.filter((scope) => !available.includes(scope));
  if (missing.length > 0) {
    throw new DomainError('insufficient_scope');
  }

  return caller;
}
