import { describe, it, expect } from 'vitest';
import { withClient, query } from '../pg.js';

// The catalogue `anon` is allowed to read (0018). Anything else in `public` is
// either private or write-only through the Core.
const ANON_READABLE = [
  'currencies',
  'profiles',
  'rate_limit_counters',
  'settings',
  'settings_categories',
  'translations',
];

/**
 * Supabase's bootstrap grants ALL on every table in `public` to `anon` and
 * `authenticated` through default privileges. This test pins the explicit
 * matrix of 0018 so a CLI upgrade that brings those defaults back fails here
 * instead of silently widening the API surface.
 */
describe('privileges: public schema', () => {
  it('anon has no write privilege on any table in public', async () => {
    await withClient(async (c) => {
      const { rows } = await query(
        c,
        `select t.table_name,
                has_table_privilege('anon', format('public.%I', t.table_name), 'insert') as can_insert,
                has_table_privilege('anon', format('public.%I', t.table_name), 'update') as can_update,
                has_table_privilege('anon', format('public.%I', t.table_name), 'delete') as can_delete
           from information_schema.tables t
          where t.table_schema = 'public'
            and t.table_type = 'BASE TABLE'
          order by t.table_name`,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((r) => r.can_insert || r.can_update || r.can_delete).map((r) => r.table_name)).toEqual([]);

      // Column-level grants are a separate ACL entry: has_table_privilege misses them.
      const columns = await query(
        c,
        `select column_name
           from information_schema.column_privileges
          where table_schema = 'public'
            and grantee = 'anon'
            and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'REFERENCES')
          order by column_name`,
      );
      expect(columns.rows).toEqual([]);
    });
  });

  it('anon only reads the public catalogue', async () => {
    await withClient(async (c) => {
      const { rows } = await query(
        c,
        `select t.table_name,
                has_table_privilege('anon', format('public.%I', t.table_name), 'select') as can_select
           from information_schema.tables t
          where t.table_schema = 'public'
            and t.table_type = 'BASE TABLE'
          order by t.table_name`,
      );
      expect(rows.filter((r) => r.can_select).map((r) => r.table_name)).toEqual(ANON_READABLE);
    });
  });

  it('authenticated has no table-level UPDATE on profiles, only the three preference columns', async () => {
    await withClient(async (c) => {
      const table = await query(
        c,
        `select has_table_privilege('authenticated', 'public.profiles', 'update') as can_update`,
      );
      expect(table.rows[0]).toEqual({ can_update: false });

      const columns = await query(
        c,
        `select column_name
           from information_schema.column_privileges
          where table_schema = 'public'
            and table_name = 'profiles'
            and grantee = 'authenticated'
            and privilege_type = 'UPDATE'
          order by column_name`,
      );
      expect(columns.rows.map((r) => r.column_name)).toEqual(['display_name', 'locale', 'timezone']);
    });
  });
});
