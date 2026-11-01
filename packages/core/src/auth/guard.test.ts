import { describe, expect, it } from 'vitest';
import { authorize } from './guard';
import { DomainError } from '../errors';
import type { Caller } from '../api/types';

const sessionCaller = (role: 'super_admin' | 'admin' | 'user'): Caller => ({
  kind: 'session',
  userId: 'u1',
  role,
});

describe('authorize — session', () => {
  it('lets a super_admin session through every scope', () => {
    const caller = sessionCaller('super_admin');
    expect(authorize(caller, ['settings:write'])).toBe(caller);
  });

  it('lets an admin session read and manage users', () => {
    expect(() => authorize(sessionCaller('admin'), ['users:read'])).not.toThrow();
    expect(() => authorize(sessionCaller('admin'), ['users:write'])).not.toThrow();
  });

  it('denies a user session a management scope with 403', () => {
    expect(() => authorize(sessionCaller('user'), ['users:read'])).toThrowError(DomainError);
    try {
      authorize(sessionCaller('user'), ['users:read']);
    } catch (err) {
      expect((err as DomainError).code).toBe('insufficient_scope');
    }
  });

  it('lets any authenticated session read its own profile', () => {
    expect(() => authorize(sessionCaller('user'), ['profile:read'])).not.toThrow();
    expect(() => authorize(sessionCaller('admin'), ['profile:read'])).not.toThrow();
  });
});

describe('authorize — service keys', () => {
  it('caps a service key with roleCap admin below super_admin scopes', () => {
    const caller: Caller = { kind: 'service', keyId: 'k1', scopes: ['settings:write'], roleCap: 'admin' };
    expect(() => authorize(caller, ['settings:write'])).not.toThrow();
    expect(() => authorize(caller, ['users:write'])).toThrowError(DomainError);
    try {
      authorize(caller, ['users:write']);
    } catch (err) {
      expect((err as DomainError).code).toBe('insufficient_scope');
    }
  });

  it('caps a delegated key by its roleCap', () => {
    const caller: Caller = {
      kind: 'delegated',
      keyId: 'k1',
      scopes: ['profile:read'],
      roleCap: 'admin',
      userId: 'u1',
    };
    expect(() => authorize(caller, ['profile:read'])).not.toThrow();
    expect(() => authorize(caller, ['users:write'])).toThrowError(DomainError);
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
