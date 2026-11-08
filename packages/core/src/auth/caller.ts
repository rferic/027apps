/**
 * Caller resolution: turns an HTTP request into a `Caller` (ADR 0004).
 *
 * `Authorization: Bearer <jwt>` → session caller after the JWT is verified with
 * `getUser(jwt)` and the profile role is read from `profiles`. No header →
 * anon caller (the door decides whether it is admitted). Invalid token → 401.
 *
 * The Supabase client and the profiles port are injected so the door can be
 * tested without the real database.
 */

import { DomainError } from '../errors';
import type { Caller } from '../api/types';

export interface SupabaseSessionClient {
  getUser(jwt: string): Promise<{
    data: { user: { id: string; email: string | null } | null };
    error: { message: string } | null;
  }>;
}

export interface ProfilesPort {
  /** Reads the role for a user id; `null` if the profile does not exist. */
  getRole(userId: string): Promise<'super_admin' | 'admin' | 'user' | null>;
  /** True when the profile exists and is not deactivated. */
  isActive(userId: string): Promise<boolean>;
}

/** Resolves a machine token (service/delegated) live from the database. */
export interface ApiKeyTokenPort {
  resolve(token: string): Promise<{
    id: string;
    kind: 'service' | 'delegated';
    scopes: string[];
    roleCap: 'admin' | 'super_admin' | null;
    userId: string | null;
  } | null>;
}

export interface CallerResolverDeps {
  supabase: SupabaseSessionClient;
  profiles: ProfilesPort;
  apiKeys?: ApiKeyTokenPort;
}

export async function resolveCaller(req: Request, deps: CallerResolverDeps): Promise<Caller> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { kind: 'anon' };
  }

  const token = authHeader.slice('Bearer '.length).trim();

  // Machine tokens: revocation and expiry are checked on every request, so a
  // revoked key stops working on the very next call (tokens spec §5/§6).
  if (token.startsWith('027_svc_') || token.startsWith('027_usr_')) {
    const key = await deps.apiKeys?.resolve(token);
    if (!key) throw new DomainError('unauthorized', 'Invalid, revoked or expired API key');
    if (key.kind === 'service') {
      if (!key.roleCap) throw new DomainError('unauthorized', 'Service key without a role cap');
      return { kind: 'service', keyId: key.id, scopes: key.scopes, roleCap: key.roleCap };
    }
    if (!key.userId) throw new DomainError('unauthorized', 'Delegated key without a user');
    const active = await deps.profiles.isActive(key.userId);
    if (!active) throw new DomainError('unauthorized', 'Profile missing or deactivated');
    // A delegated key is always a plain user: the owner's live role (and any
    // stored role_cap) is ignored, so it can never widen into administration.
    return {
      kind: 'delegated',
      keyId: key.id,
      scopes: key.scopes,
      roleCap: 'user',
      userId: key.userId,
    };
  }

  const { data, error } = await deps.supabase.getUser(token);
  if (error || !data.user) {
    throw new DomainError('unauthorized', error?.message ?? 'Invalid session token');
  }

  const { id: userId } = data.user;
  const [role, active] = await Promise.all([
    deps.profiles.getRole(userId),
    deps.profiles.isActive(userId),
  ]);
  if (!role || !active) {
    throw new DomainError('unauthorized', 'Profile missing or deactivated');
  }

  return { kind: 'session', userId, role };
}
