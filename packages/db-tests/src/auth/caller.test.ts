import { describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ClientBase } from 'pg';
import { withClient, query } from '../pg.js';
import { resolveCaller, type CallerResolverDeps, type ProfilesPort } from '@027apps/core/auth/caller.js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function profilesPort(c: ClientBase): ProfilesPort {
  return {
    async getRole(userId: string) {
      const { rows } = await query(c, 'SELECT role FROM public.profiles WHERE id = $1', [userId]);
      const row = rows[0] as { role: string } | undefined;
      return (row?.role as 'super_admin' | 'admin' | 'user') ?? null;
    },
    async isActive(userId: string) {
      const { rows } = await query(
        c,
        'SELECT deactivated_at IS NULL AS active FROM public.profiles WHERE id = $1',
        [userId],
      );
      const row = rows[0] as { active: boolean } | undefined;
      return row?.active ?? false;
    },
  };
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

function sessionDeps(c: ClientBase): CallerResolverDeps {
  const supabase = createClient(SUPABASE_URL, ANON_KEY);
  return {
    supabase: {
      async getUser(jwt: string) {
        const { data, error } = await supabase.auth.getUser(jwt);
        return {
          data: { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null },
          error: error ? { message: error.message } : null,
        };
      },
    },
    profiles: profilesPort(c),
  };
}

/**
 * Creates a real auth user via the Admin API (service_role) — sign-in only
 * works for users created by GoTrue (a raw SQL insert into auth.users leaves
 * no auth.identities row and GoTrue fails to authenticate it) — and mirrors
 * the profile inside the caller's transaction.
 */
async function createAuthUser(
  c: ClientBase,
  opts: { email: string; role: 'super_admin' | 'admin' | 'user'; displayName: string },
): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email: opts.email,
    password: 'test-password',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`admin.createUser failed: ${error?.message}`);
  await query(c, 'INSERT INTO public.profiles (id, display_name, role) VALUES ($1, $2, $3)', [
    data.user.id,
    opts.displayName,
    opts.role,
  ]);
  return data.user.id;
}

async function signIn(email: string, password: string): Promise<string> {
  const { data, error } = await serviceClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signInWithPassword failed: ${error?.message}`);
  return data.session.access_token;
}

describe('resolveCaller — local stack', () => {
  it('resolves a session caller with the profile role', async () => {
    const email = `caller-${Date.now()}@test.local`;
    await withClient(async (c) => {
      await c.query('BEGIN');
      const userId = await createAuthUser(c, { email, role: 'admin', displayName: 'Caller Admin' });
      try {
        const token = await signIn(email, 'test-password');

        const caller = await resolveCaller(
          new Request('http://local/api/v1/ping', {
            headers: { authorization: `Bearer ${token}` },
          }),
          sessionDeps(c),
        );

        expect(caller).toEqual({ kind: 'session', userId: expect.any(String), role: 'admin' });
      } finally {
        await c.query('ROLLBACK');
        await serviceClient().auth.admin.deleteUser(userId);
      }
    });
  });

  it('returns an anon caller without an Authorization header', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const caller = await resolveCaller(
        new Request('http://local/api/v1/ping'),
        sessionDeps(c),
      );
      expect(caller).toEqual({ kind: 'anon' });
      await c.query('ROLLBACK');
    });
  });

  it('rejects an invalid token with 401', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await expect(
        resolveCaller(
          new Request('http://local/api/v1/ping', {
            headers: { authorization: 'Bearer not-a-jwt' },
          }),
          sessionDeps(c),
        ),
      ).rejects.toMatchObject({ code: 'unauthorized' });
      await c.query('ROLLBACK');
    });
  });

  it('rejects a session caller whose profile is deactivated', async () => {
    const email = `caller-dead-${Date.now()}@test.local`;
    await withClient(async (c) => {
      await c.query('BEGIN');
      const userId = await createAuthUser(c, { email, role: 'user', displayName: 'Caller Dead' });
      try {
        await query(c, 'UPDATE public.profiles SET deactivated_at = now() WHERE id = $1', [userId]);
        const token = await signIn(email, 'test-password');

        await expect(
          resolveCaller(
            new Request('http://local/api/v1/ping', {
              headers: { authorization: `Bearer ${token}` },
            }),
            sessionDeps(c),
          ),
        ).rejects.toMatchObject({ code: 'unauthorized' });
      } finally {
        await c.query('ROLLBACK');
        await serviceClient().auth.admin.deleteUser(userId);
      }
    });
  });
});
