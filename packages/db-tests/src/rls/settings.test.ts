import { describe, it, expect } from 'vitest';
import type { ClientBase } from 'pg';
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from '../pg.js';

async function seedCategory(c: ClientBase, key = 'instance') {
  await query(c, `insert into public.settings_categories (category_key, label, sort_order) values ($1, $2, $3)
                  on conflict (category_key) do nothing`, [key, 'Instance', 10]);
}

async function seedSetting(c: ClientBase, key = 'instance.name', opts: { isSecret?: boolean; value?: unknown } = {}) {
  await query(c, `insert into public.settings (category_key, key, label, value, value_encrypted, is_secret, is_public, mcp_access)
                  values ('instance', $1, 'Name', $2, $3, $4, false, 'read')`, [
    key,
    opts.isSecret ? null : JSON.stringify(opts.value ?? '027Apps'),
    opts.isSecret ? 'v1:iv:tag:ct' : null,
    opts.isSecret ?? false,
  ]);
}

describe('RLS: settings', () => {
  it('a regular user cannot read settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await seedSetting(c);
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.settings')).resolves.toBe(0);
      await expect(count(c, 'select count(*) from public.settings_categories')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('an admin can read settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await seedSetting(c);
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.settings')).resolves.toBe(1);
      await expect(count(c, 'select count(*) from public.settings_categories')).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('anon cannot read settings or settings_categories (0 rows, not permission denied)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await seedSetting(c);
      await impersonateAnon(c);
      await expect(count(c, 'select count(*) from public.settings')).resolves.toBe(0);
      await expect(count(c, 'select count(*) from public.settings_categories')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('a user cannot insert or update settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await seedSetting(c);
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      // SAVEPOINT: an expected failure leaves the transaction aborted; each
      // negative assertion goes in its own savepoint so it does not mask the next error.
      await c.query('SAVEPOINT sp1');
      await expect(
        query(c, `insert into public.settings (category_key, key, label) values ('instance', 'hax.key', 'Hack')`),
      ).rejects.toThrowError(/new row violates row-level security|permission denied/i);
      await c.query('ROLLBACK TO SAVEPOINT sp1');
      await c.query('SAVEPOINT sp2');
      await expect(
        query(c, `update public.settings set value = '"hacked"'::jsonb where key = 'instance.name'`),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query('ROLLBACK TO SAVEPOINT sp2');
      await c.query('ROLLBACK');
    });
  });

  it('an admin cannot insert settings (writes go through the API with service_role)', async () => {
    // Design decision: settings writes go through the /settings door (service_role),
    // which audits and validates; at the SQL level only admin and super_admin could
    // (in a future module), but in v1 the write policy is service_role only. The policy denies it.
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'super_admin' });
      await impersonate(c, id);
      await expect(
        query(c, `insert into public.settings (category_key, key, label) values ('instance', 'v.w', 'X')`),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query('ROLLBACK');
    });
  });

  it('CHECK: a setting with is_secret=true and a plaintext value is rejected', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await expect(
        query(c, `insert into public.settings (category_key, key, label, value, is_secret)
                  values ('instance', 'secret.v', 'S', '"plain"'::jsonb, true)`),
      ).rejects.toThrowError(/check constraint|settings/i);
      await c.query('ROLLBACK');
    });
  });

  it('CHECK: a setting with is_secret=false and value_encrypted is rejected', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await expect(
        query(c, `insert into public.settings (category_key, key, label, value_encrypted)
                  values ('instance', 'plain.v', 'P', 'v1:iv:tag:ct')`),
      ).rejects.toThrowError(/check constraint|settings/i);
      await c.query('ROLLBACK');
    });
  });

  it('CHECK: updated_by and updated_by_key together are rejected', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await expect(
        query(c, `insert into public.settings (category_key, key, label, value, updated_by, updated_by_key)
                  values ('instance', 'k.v', 'K', '"v"'::jsonb, $1, gen_random_uuid())`, [id]),
      ).rejects.toThrowError(/check constraint|settings/i);
      await c.query('ROLLBACK');
    });
  });
});
