/**
 * Authorization guard: scopes by action with `role_cap` (ADR 0004).
 *
 * A session caller's role is mapped to a fixed scope set; a service or
 * delegated key is capped by `roleCap` (an admin key can never act as
 * super_admin). Any missing scope → 403 `insufficient_scope`, without
 * enumerating the resource; anon → 401 `unauthorized`.
 */

import { DomainError } from '../errors';
import type { Caller } from '../api/types';

const USER_SCOPES = [
  'profile:read',
  'profile:write',
  'currencies:read',
  'api_keys:read',
  'api_keys:write',
  'api_keys:revoke',
  'devices:read',
  'devices:write',
  'devices:revoke',
] as const;

const ADMIN_SCOPES = [
  ...USER_SCOPES,
  'users:read',
  'users:write',
  'roles:assign',
  'user_categories:read',
  'user_categories:write',
  'modules:read',
  'modules:grant',
  'invitations:read',
  'invitations:write',
  'settings:read',
  'settings:write',
  'currencies:write',
] as const;

const SUPER_ADMIN_SCOPES = [...ADMIN_SCOPES, 'users:deactivate'] as const;

const SESSION_SCOPES: Record<'super_admin' | 'admin' | 'user', readonly string[]> = {
  super_admin: SUPER_ADMIN_SCOPES,
  admin: ADMIN_SCOPES,
  user: USER_SCOPES,
};

const ROLE_CAP_FLOOR: Record<'user' | 'admin' | 'super_admin', readonly string[]> = {
  user: USER_SCOPES,
  admin: ADMIN_SCOPES,
  super_admin: SUPER_ADMIN_SCOPES,
};

export function authorize(caller: Caller, scopes: readonly string[]): Caller {
  if (caller.kind === 'anon') {
    throw new DomainError('unauthorized');
  }

  let available: readonly string[];
  if (caller.kind === 'session') {
    available = SESSION_SCOPES[caller.role];
  } else {
    available = caller.scopes.filter((s) => ROLE_CAP_FLOOR[caller.roleCap].includes(s));
  }

  const missing = scopes.filter((s) => !available.includes(s));
  if (missing.length > 0) {
    throw new DomainError('insufficient_scope');
  }

  return caller;
}
