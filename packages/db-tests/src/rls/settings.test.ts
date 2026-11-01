import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, createTestUser } from '../pg.js';

async function seedCategory(c: any, key = 'instance') {
  await query(c, `insert into public.settings_categories (category_key, label, sort_order) values ($1, $2, $3)
                  on conflict (category_key) do nothing`, [key, 'Instance', 10]);
}

async function seedSetting(c: any, key = 'instance.name', opts: { isSecret?: boolean; value?: unknown } = {}) {
  await query(c, `insert into public.settings (category_key, key, label, value, value_encrypted, is_secret, is_public, mcp_access)
                  values ('instance', $1, 'Name', $2, $3, $4, false, 'read')`, [
    key,
    opts.isSecret ? null : JSON.stringify(opts.value ?? '027Apps'),
    opts.isSecret ? 'v1:iv:tag:ct' : null,
    opts.isSecret ?? false,
  ]);
}

describe('RLS: settings', () => {
  it('un usuario normal no puede leer settings', async () => {
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

  it('un admin puede leer settings', async () => {
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

  it('un usuario no puede insertar ni actualizar settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await seedCategory(c);
      await seedSetting(c);
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      // SAVEPOINT: un fallo esperado deja la transacción abortada; cada aserción
      // negativa va en su propio savepoint para no enmascarar el error siguiente.
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

  it('un admin no puede insertar settings (la escritura pasa por la API con service_role)', async () => {
    // Decisión de diseño: la escritura de settings es la puerta /settings (service_role),
    // que audita y valida; en SQL solo admin y super_admin pueden (en un módulo futuro),
    // pero en v1 la política de escritura es solo service_role. La política lo deniega.
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

  it('CHECK: un setting is_secret=true con value (no cifrado) se rechaza', async () => {
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

  it('CHECK: un setting is_secret=false con value_encrypted se rechaza', async () => {
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

  it('CHECK: updated_by y updated_by_key simultáneos se rechazan', async () => {
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
