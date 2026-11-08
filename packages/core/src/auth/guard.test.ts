import { describe, expect, it } from 'vitest';
import { authorize, DELEGATED_SCOPES, isModuleScope } from './guard';
import { DomainError } from '../errors';
import type { Caller } from '../api/types';

const sessionCaller = (role: 'super_admin' | 'admin' | 'user'): Caller => ({
  kind: 'session',
  userId: 'u1',
  role,
});

const delegatedCaller = (
  scopes: string[],
  roleCap: 'user' | 'admin' | 'super_admin' = 'user',
): Caller => ({
  kind: 'delegated',
  keyId: 'k1',
  scopes,
  roleCap,
  userId: 'u1',
});

const serviceCaller = (scopes: string[], roleCap: 'admin' | 'super_admin'): Caller => ({
  kind: 'service',
  keyId: 'k1',
  scopes,
  roleCap,
});

function expectForbidden(caller: Caller, scope: string) {
  expect(() => authorize(caller, [scope])).toThrowError(DomainError);
  try {
    authorize(caller, [scope]);
  } catch (err) {
    expect((err as DomainError).code).toBe('insufficient_scope');
  }
}

describe('authorize — session', () => {
  it('lets a super_admin session through its management scopes', () => {
    const caller = sessionCaller('super_admin');
    expect(authorize(caller, ['settings:write', 'users:deactivate'])).toBe(caller);
    expectForbidden(caller, 'maintenance:run');
  });

  it('lets an admin session read and manage users', () => {
    expect(() => authorize(sessionCaller('admin'), ['users:read'])).not.toThrow();
    expect(() => authorize(sessionCaller('admin'), ['users:write'])).not.toThrow();
  });

  it('keeps api_keys:* on every session role: users manage their own keys', () => {
    for (const role of ['user', 'admin', 'super_admin'] as const) {
      expect(() => authorize(sessionCaller(role), ['api_keys:read'])).not.toThrow();
      expect(() => authorize(sessionCaller(role), ['api_keys:write'])).not.toThrow();
      expect(() => authorize(sessionCaller(role), ['api_keys:revoke'])).not.toThrow();
    }
  });

  it('denies a user session a management scope with 403', () => {
    expectForbidden(sessionCaller('user'), 'users:read');
  });

  it('lets any authenticated session read its own profile', () => {
    expect(() => authorize(sessionCaller('user'), ['profile:read'])).not.toThrow();
    expect(() => authorize(sessionCaller('admin'), ['profile:read'])).not.toThrow();
  });
});

describe('authorize — delegated keys', () => {
  it('accepts exactly the delegated allowlist', () => {
    for (const scope of DELEGATED_SCOPES) {
      expect(() => authorize(delegatedCaller([scope]), [scope])).not.toThrow();
    }
  });

  it('trims admin scopes stored on a delegated key', () => {
    for (const scope of [
      'settings:read',
      'settings:write',
      'currencies:write',
      'users:write',
      'users:deactivate',
      'roles:assign',
      'user_categories:write',
      'invitations:read',
      'invitations:write',
      'modules:grant',
      'modules:manage',
      'maintenance:run',
    ]) {
      expectForbidden(delegatedCaller([scope]), scope);
    }
  });

  it('never lets a delegated key act as an admin, whatever its stored role cap', () => {
    for (const roleCap of ['admin', 'super_admin'] as const) {
      expectForbidden(delegatedCaller(['settings:read'], roleCap), 'settings:read');
      expectForbidden(delegatedCaller(['users:write'], roleCap), 'users:write');
      expectForbidden(delegatedCaller(['maintenance:run'], roleCap), 'maintenance:run');
      // The delegated allowlist still works: the cap is ignored, not a floor.
      expect(() =>
        authorize(delegatedCaller(['users:read'], roleCap), ['users:read']),
      ).not.toThrow();
    }
  });

  it('accepts module scopes by pattern and denies Core namespaces', () => {
    expect(isModuleScope('expenses:read')).toBe(true);
    expect(isModuleScope('expenses:read_write')).toBe(true);
    expect(isModuleScope('settings:read')).toBe(false);
    expect(isModuleScope('expenses:write')).toBe(false);
    expect(() => authorize(delegatedCaller(['expenses:read']), ['expenses:read'])).not.toThrow();
    expectForbidden(delegatedCaller(['settings:read']), 'settings:read');
  });

  it('drops scopes stored outside the allowlist while the rest keep working', () => {
    const caller = delegatedCaller(['profile:read', 'settings:write']);
    expect(() => authorize(caller, ['profile:read'])).not.toThrow();
    expectForbidden(caller, 'settings:write');
  });
});

describe('authorize — service keys', () => {
  it('caps a service key with roleCap admin below super_admin scopes', () => {
    const caller = serviceCaller(['settings:write', 'users:deactivate'], 'admin');
    expect(() => authorize(caller, ['settings:write'])).not.toThrow();
    expectForbidden(caller, 'users:deactivate');
    expectForbidden(caller, 'maintenance:run');
  });

  it('lets a service key with the super_admin cap run both restricted actions', () => {
    const caller = serviceCaller(['users:deactivate', 'maintenance:run'], 'super_admin');
    expect(() => authorize(caller, ['users:deactivate'])).not.toThrow();
    expect(() => authorize(caller, ['maintenance:run'])).not.toThrow();
  });

  it('never gives a service key profile or device scopes', () => {
    for (const roleCap of ['admin', 'super_admin'] as const) {
      const caller = serviceCaller(['profile:read', 'devices:read'], roleCap);
      expectForbidden(caller, 'profile:read');
      expectForbidden(caller, 'devices:read');
    }
  });

  it('keeps api_keys:* on both caps', () => {
    for (const roleCap of ['admin', 'super_admin'] as const) {
      const caller = serviceCaller(['api_keys:read'], roleCap);
      expect(() => authorize(caller, ['api_keys:read'])).not.toThrow();
    }
  });

  it('rejects module scopes on a service key', () => {
    expectForbidden(serviceCaller(['expenses:read'], 'super_admin'), 'expenses:read');
  });
});

describe('authorize — anon', () => {
  it('rejects an anon caller with 401', () => {
    expect(() => authorize({ kind: 'anon' }, ['profile:read'])).toThrowError(DomainError);
    try {
      authorize({ kind: 'anon' }, ['profile:read']);
    } catch (err) {
      expect((err as DomainError).code).toBe('unauthorized');
    }
  });
});
