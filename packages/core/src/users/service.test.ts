import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '../api/rate-limit-storage.js';
import type { Caller } from '../api/types.js';
import {
  deactivateUser,
  listUsers,
  purgeUser,
  restoreUser,
  updateUser,
  type Role,
  type UsersDeps,
} from './service.js';

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

/** In-memory `profiles` backing the reads and writes the service uses. */
function makeDeps(initial: ProfileRow[]): {
  deps: UsersDeps;
  profiles: Map<string, ProfileRow>;
  query: ReturnType<typeof vi.fn>;
} {
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
    if (
      sql.startsWith(
        'select id from public.profiles where role = \'super_admin\' and deactivated_at is null',
      )
    ) {
      const roots = [...profiles.values()]
        .filter((row) => row.role === 'super_admin' && row.deactivated_at === null)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      return { rows: roots[0] ? [{ id: roots[0].id }] : [] };
    }
    if (sql.startsWith('select id from public.profiles where role = \'super_admin\'')) {
      const roots = [...profiles.values()]
        .filter((row) => row.role === 'super_admin')
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      return { rows: roots[0] ? [{ id: roots[0].id }] : [] };
    }
    // Paginated list: q, role, state, limit, offset.
    if (sql.startsWith('select p.id')) {
      const [pattern, role, state, limit, offset] = params as [
        string | null,
        Role | null,
        boolean | null,
        number,
        number,
      ];
      const needle = pattern ? pattern.replace(/[\\%_]/g, '').toLowerCase() : null;
      const rows = [...profiles.values()]
        .filter((row) => !needle || row.display_name.toLowerCase().includes(needle))
        .filter((row) => !role || row.role === role)
        .filter((row) => state === null || (row.deactivated_at === null) === state)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .slice(offset, offset + limit);
      return { rows };
    }
    // Totals: q and role only; `state` filters the page and `total`, while
    // `active_total` keeps counting active profiles among the q/role matches.
    if (sql.startsWith('select count(*) filter')) {
      const [pattern, role, state] = params as [string | null, Role | null, boolean | null];
      const needle = pattern ? pattern.replace(/[\\%_]/g, '').toLowerCase() : null;
      const matching = [...profiles.values()]
        .filter((row) => !needle || row.display_name.toLowerCase().includes(needle))
        .filter((row) => !role || row.role === role);
      const filtered = matching.filter(
        (row) => state === null || (row.deactivated_at === null) === state,
      );
      return {
        rows: [
          {
            n: filtered.length,
            active_total: matching.filter((row) => row.deactivated_at === null).length,
          },
        ],
      };
    }
    if (sql.startsWith('select count(*)::int as n from public.profiles')) {
      const n = [...profiles.values()].filter(
        (row) => row.role === 'super_admin' && row.deactivated_at === null,
      ).length;
      return { rows: [{ n }] };
    }
    if (sql.includes('set deactivated_at = null')) {
      const row = profiles.get(String(params[0]));
      if (row) row.deactivated_at = null;
      return { rows: [] };
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
      sql.startsWith('update public.settings') ||
      sql.startsWith('update public.invitations') ||
      sql.startsWith('update public.translations') ||
      sql.startsWith('update public.user_categories') ||
      sql.startsWith('update public.user_modules') ||
      sql.startsWith('update public.user_category_modules') ||
      sql.startsWith('insert into public.event_outbox')
    ) {
      return { rows: [] };
    }
    if (sql.startsWith('delete from auth.users')) {
      profiles.delete(String(params[0]));
      return { rows: [] };
    }
    throw new Error(`unexpected SQL: ${sql}`);
  });

  return {
    deps: { db: { query: query as QueryClient['query'] } },
    profiles,
    query,
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

describe('restoreUser', () => {
  it('clears deactivated_at and returns the active view', async () => {
    const { deps, profiles } = makeDeps([
      profile('root', { role: 'super_admin', created_at: '2025-01-01T00:00:00.000Z' }),
      profile('other', { role: 'user', deactivated_at: '2026-02-01T00:00:00.000Z' }),
    ]);

    const restored = await restoreUser(deps, session('root', 'super_admin'), 'other');

    expect(restored.deactivated_at).toBeNull();
    expect(restored.id).toBe('other');
    expect(profiles.get('other')?.deactivated_at).toBeNull();
  });

  it('is idempotent: an already active profile returns 200 without a write', async () => {
    const { deps, profiles, query } = makeDeps([
      profile('root', { role: 'super_admin', created_at: '2025-01-01T00:00:00.000Z' }),
      profile('other', { role: 'user' }),
    ]);

    const restored = await restoreUser(deps, session('root', 'super_admin'), 'other');

    expect(restored.deactivated_at).toBeNull();
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('set deactivated_at = null')),
    ).toBe(false);
    expect(profiles.get('other')?.deactivated_at).toBeNull();
  });

  it('throws not_found when the profile does not exist', async () => {
    const { deps } = makeDeps([profile('root', { role: 'super_admin' })]);

    await expect(
      restoreUser(deps, session('root', 'super_admin'), 'missing'),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('rejects a caller that is not a session super_admin', async () => {
    const { deps } = makeDeps([
      profile('root', { role: 'super_admin' }),
      profile('admin', { role: 'admin' }),
    ]);

    await expect(restoreUser(deps, session('admin', 'admin'), 'root')).rejects.toMatchObject({
      code: 'insufficient_scope',
    });
    await expect(
      restoreUser(
        deps,
        { kind: 'service', keyId: 'k1', scopes: [], roleCap: 'super_admin' },
        'root',
      ),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
  });
});

describe('listUsers — role and state filters', () => {
  const PEOPLE = [
    profile('root', { role: 'super_admin' }),
    profile('ana', { role: 'admin', display_name: 'Ana', created_at: '2026-01-02T00:00:00.000Z' }),
    profile('luis', { role: 'user', display_name: 'Luis', created_at: '2026-01-03T00:00:00.000Z' }),
    profile('marta', {
      role: 'user',
      display_name: 'Marta',
      created_at: '2026-01-04T00:00:00.000Z',
      deactivated_at: '2026-02-01T00:00:00.000Z',
    }),
  ];

  it('filters by role and keeps the total consistent with the page', async () => {
    const { deps } = makeDeps(PEOPLE);

    const result = await listUsers(deps, { role: 'user', state: 'all', limit: 20, offset: 0 });

    expect(result.users.map((user) => user.id)).toEqual(['luis', 'marta']);
    expect(result.total).toBe(2);
    expect(result.active_total).toBe(1);
  });

  it('defaults to active profiles when state is omitted', async () => {
    const { deps } = makeDeps(PEOPLE);

    const result = await listUsers(deps, { limit: 20, offset: 0 });

    expect(result.users.map((user) => user.id)).toEqual(['root', 'ana', 'luis']);
    expect(result.total).toBe(3);
    expect(result.active_total).toBe(3);
  });

  it('includes deactivated profiles only with state=all', async () => {
    const { deps } = makeDeps(PEOPLE);

    const result = await listUsers(deps, { state: 'all', limit: 20, offset: 0 });

    expect(result.users.map((user) => user.id)).toEqual(['root', 'ana', 'luis', 'marta']);
    expect(result.total).toBe(4);
    expect(result.active_total).toBe(3);
  });

  it('filters by state without hiding the active total of the search', async () => {
    const { deps } = makeDeps(PEOPLE);

    const result = await listUsers(deps, { state: 'deactivated', limit: 20, offset: 0 });

    expect(result.users.map((user) => user.id)).toEqual(['marta']);
    expect(result.total).toBe(1);
    expect(result.active_total).toBe(3);
  });

  it('combines q, role and state with pagination and the correct total', async () => {
    const { deps } = makeDeps([
      profile('u1', { role: 'user', display_name: 'Ana Uno', created_at: '2026-01-01T00:00:00.000Z' }),
      profile('u2', { role: 'user', display_name: 'Ana Dos', created_at: '2026-01-02T00:00:00.000Z' }),
      profile('u3', { role: 'admin', display_name: 'Ana Admin', created_at: '2026-01-03T00:00:00.000Z' }),
      profile('u4', {
        role: 'user',
        display_name: 'Ana Off',
        created_at: '2026-01-04T00:00:00.000Z',
        deactivated_at: '2026-02-01T00:00:00.000Z',
      }),
    ]);

    const result = await listUsers(deps, {
      q: 'ana',
      role: 'user',
      state: 'active',
      limit: 1,
      offset: 1,
    });

    expect(result.users.map((user) => user.id)).toEqual(['u2']);
    expect(result.total).toBe(2);
    expect(result.active_total).toBe(2);
  });
});

describe('purgeUser', () => {
  const ROOT = profile('root', { role: 'super_admin', created_at: '2025-01-01T00:00:00.000Z' });
  const OFF = profile('off', { role: 'user', deactivated_at: '2026-02-01T00:00:00.000Z' });

  it('deletes a deactivated member and nulls every blocking reference', async () => {
    const { deps, profiles, query } = makeDeps([ROOT, OFF]);

    await purgeUser(deps, session('root', 'super_admin'), 'off');

    expect(profiles.has('off')).toBe(false);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    for (const table of [
      'public.settings',
      'public.api_keys',
      'public.invitations',
      'public.translations',
      'public.user_categories',
      'public.user_modules',
      'public.user_category_modules',
    ]) {
      expect(statements.some((sql) => sql.includes(`update ${table} set`))).toBe(true);
    }
    expect(statements.some((sql) => sql.startsWith('delete from auth.users'))).toBe(true);
    const attributeWrites = query.mock.calls.filter(([sql]) =>
      String(sql).startsWith('update public.'),
    );
    expect(attributeWrites.every(([, params]) => (params as unknown[])[0] === 'off')).toBe(true);
  });

  it('refuses an active member: it must be deactivated first', async () => {
    const { deps, profiles, query } = makeDeps([ROOT, profile('active', { role: 'user' })]);

    await expect(purgeUser(deps, session('root', 'super_admin'), 'active')).rejects.toMatchObject({
      code: 'conflict',
      message: 'Deactivate the member before deleting it',
    });
    expect(profiles.has('active')).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('delete from auth.users'))).toBe(
      false,
    );
  });

  it('protects the caller’s own account', async () => {
    const { deps, profiles } = makeDeps([
      ROOT,
      profile('self', { role: 'super_admin', deactivated_at: '2026-02-01T00:00:00.000Z' }),
    ]);

    await expect(purgeUser(deps, session('self', 'super_admin'), 'self')).rejects.toMatchObject({
      code: 'conflict',
      message: 'You cannot delete your own account',
    });
    expect(profiles.has('self')).toBe(true);
  });

  it('protects the root even when it is deactivated', async () => {
    const { deps, profiles } = makeDeps([
      profile('root', {
        role: 'super_admin',
        created_at: '2025-01-01T00:00:00.000Z',
        deactivated_at: '2026-02-01T00:00:00.000Z',
      }),
      profile('other', { role: 'super_admin' }),
    ]);

    await expect(purgeUser(deps, session('other', 'super_admin'), 'root')).rejects.toMatchObject({
      code: 'conflict',
      message: 'The root user cannot be deleted',
    });
    expect(profiles.has('root')).toBe(true);
  });

  it('protects the last active super_admin', async () => {
    const { deps, profiles } = makeDeps([
      ROOT,
      profile('only', {
        role: 'super_admin',
        deactivated_at: '2026-02-01T00:00:00.000Z',
      }),
    ]);

    await expect(purgeUser(deps, session('root', 'super_admin'), 'only')).rejects.toMatchObject({
      code: 'conflict',
      message: 'The instance needs at least one active super_admin',
    });
    expect(profiles.has('only')).toBe(true);
  });

  it('answers not_found for a missing profile', async () => {
    const { deps } = makeDeps([ROOT]);

    await expect(purgeUser(deps, session('root', 'super_admin'), 'missing')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('rejects a caller that is not a session super_admin', async () => {
    const { deps, profiles } = makeDeps([ROOT, OFF]);

    await expect(purgeUser(deps, session('admin', 'admin'), 'off')).rejects.toMatchObject({
      code: 'insufficient_scope',
    });
    await expect(
      purgeUser(deps, { kind: 'service', keyId: 'k1', scopes: [], roleCap: 'super_admin' }, 'off'),
    ).rejects.toMatchObject({ code: 'insufficient_scope' });
    expect(profiles.has('off')).toBe(true);
  });
});
