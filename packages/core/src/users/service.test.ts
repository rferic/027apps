import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '../api/rate-limit-storage.js';
import type { Caller } from '../api/types.js';
import { deactivateUser, updateUser, type Role, type UsersDeps } from './service.js';

type ProfileRow = {
  id: string;
  display_name: string;
  locale: string;
  timezone: string;
  role: Role;
  created_at: string;
  deactivated_at: string | null;
};

function profile(id: string, overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id,
    display_name: id,
    locale: 'en',
    timezone: 'UTC',
    role: 'user',
    created_at: '2026-01-01T00:00:00.000Z',
    deactivated_at: null,
    ...overrides,
  };
}

/** In-memory `profiles` backing the three reads and two writes the service uses. */
function makeDeps(initial: ProfileRow[]): { deps: UsersDeps; profiles: Map<string, ProfileRow> } {
  const profiles = new Map(initial.map((row) => [row.id, { ...row }]));

  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (
      sql.startsWith(
        'select id, display_name, locale, timezone, role, created_at, deactivated_at from public.profiles where id = $1',
      )
    ) {
      const row = profiles.get(String(params[0]));
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith("select id from public.profiles where role = 'super_admin'")) {
      const roots = [...profiles.values()]
        .filter((row) => row.role === 'super_admin' && row.deactivated_at === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      return { rows: roots[0] ? [{ id: roots[0].id }] : [] };
    }
    if (sql.startsWith('select count(*)::int as n from public.profiles')) {
      const n = [...profiles.values()].filter(
        (row) => row.role === 'super_admin' && row.deactivated_at === null,
      ).length;
      return { rows: [{ n }] };
    }
    if (sql.includes('set deactivated_at = coalesce(deactivated_at, now())')) {
      const row = profiles.get(String(params[0]));
      if (row && row.deactivated_at === null) row.deactivated_at = '2026-02-01T00:00:00.000Z';
      return { rows: [] };
    }
    if (sql.startsWith('update public.profiles')) {
      const [id, display_name, locale, timezone, role] = params;
      const row = profiles.get(String(id));
      if (row) {
        if (display_name !== null) row.display_name = String(display_name);
        if (locale !== null) row.locale = String(locale);
        if (timezone !== null) row.timezone = String(timezone);
        if (role !== null) row.role = role as Role;
      }
      return { rows: [] };
    }
    if (
      sql.startsWith('update public.api_keys') ||
      sql.startsWith('update public.devices') ||
      sql.startsWith('insert into public.event_outbox')
    ) {
      return { rows: [] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });

  return {
    deps: { db: { query: query as QueryClient['query'] } },
    profiles,
  };
}

const session = (userId: string, role: Role): Caller => ({ kind: 'session', userId, role });

describe('updateUser — self role changes', () => {
  it('rejects a session changing its own role', async () => {
    const { deps, profiles } = makeDeps([
      profile('self', { role: 'super_admin' }),
      profile('other', { role: 'admin' }),
    ]);

    await expect(
      updateUser(deps, session('self', 'super_admin'), 'self', { role: 'admin' }),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'You cannot change your own role',
    });
    expect(profiles.get('self')?.role).toBe('super_admin');
  });

  it('still lets a super_admin change another person’s role', async () => {
    const { deps, profiles } = makeDeps([
      profile('self', { role: 'super_admin' }),
      profile('other', { role: 'user' }),
    ]);

    const updated = await updateUser(deps, session('self', 'super_admin'), 'other', {
      role: 'admin',
    });

    expect(updated.role).toBe('admin');
    expect(profiles.get('other')?.role).toBe('admin');
  });
});

describe('deactivateUser — self deactivation', () => {
  it('rejects a super_admin deactivating their own account', async () => {
    const { deps, profiles } = makeDeps([
      profile('root', {
        role: 'super_admin',
        created_at: '2025-01-01T00:00:00.000Z',
      }),
      profile('self', { role: 'super_admin' }),
    ]);

    await expect(deactivateUser(deps, session('self', 'super_admin'), 'self')).rejects.toMatchObject(
      {
        code: 'conflict',
        message: 'You cannot deactivate your own account',
      },
    );
    expect(profiles.get('self')?.deactivated_at).toBeNull();
  });

  it('still lets a super_admin deactivate another person', async () => {
    const { deps, profiles } = makeDeps([
      profile('root', {
        role: 'super_admin',
        created_at: '2025-01-01T00:00:00.000Z',
      }),
      profile('other', { role: 'admin' }),
    ]);

    const updated = await deactivateUser(deps, session('root', 'super_admin'), 'other');

    expect(updated.deactivated_at).not.toBeNull();
    expect(profiles.get('other')?.deactivated_at).not.toBeNull();
  });
});
