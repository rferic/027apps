import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors';
import { resolveCaller, type ApiKeyTokenPort, type ProfilesPort } from './caller';

const profiles: ProfilesPort = {
  getRole: vi.fn(async () => 'user' as const),
  isActive: vi.fn(async () => true),
};

function apiKeys(resolution: Awaited<ReturnType<ApiKeyTokenPort['resolve']>>): ApiKeyTokenPort {
  return { resolve: vi.fn(async () => resolution) };
}

const unusedSupabase = {
  getUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'unused' } })),
};

function request(token: string): Request {
  return new Request('http://local/api/v1/me', {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('resolveCaller — machine tokens', () => {
  it('resolves a service key to a service caller with its role cap', async () => {
    const port = apiKeys({
      id: 'k1',
      kind: 'service',
      scopes: ['users:read'],
      roleCap: 'admin',
      userId: null,
    });
    const caller = await resolveCaller(request('027_svc_abc'), {
      supabase: unusedSupabase,
      profiles,
      apiKeys: port,
    });

    expect(port.resolve).toHaveBeenCalledWith('027_svc_abc');
    expect(caller).toEqual({
      kind: 'service',
      keyId: 'k1',
      scopes: ['users:read'],
      roleCap: 'admin',
    });
  });

  it('resolves a delegated key to the owner with their live role', async () => {
    const port = apiKeys({
      id: 'k2',
      kind: 'delegated',
      scopes: ['profile:read'],
      roleCap: null,
      userId: 'u1',
    });
    const caller = await resolveCaller(request('027_usr_abc'), {
      supabase: unusedSupabase,
      profiles: {
        getRole: vi.fn(async () => 'admin' as const),
        isActive: vi.fn(async () => true),
      },
      apiKeys: port,
    });

    expect(caller).toEqual({
      kind: 'delegated',
      keyId: 'k2',
      scopes: ['profile:read'],
      roleCap: 'admin',
      userId: 'u1',
    });
  });

  it('rejects a revoked, expired or unknown key as 401', async () => {
    await expect(
      resolveCaller(request('027_svc_abc'), {
        supabase: unusedSupabase,
        profiles,
        apiKeys: apiKeys(null),
      }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects a delegated key whose owner is deactivated', async () => {
    await expect(
      resolveCaller(request('027_usr_abc'), {
        supabase: unusedSupabase,
        profiles: {
          getRole: vi.fn(async () => 'user' as const),
          isActive: vi.fn(async () => false),
        },
        apiKeys: apiKeys({
          id: 'k3',
          kind: 'delegated',
          scopes: [],
          roleCap: null,
          userId: 'u2',
        }),
      }),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('fails closed when the machine-token port is not configured', async () => {
    await expect(
      resolveCaller(request('027_usr_abc'), { supabase: unusedSupabase, profiles }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
