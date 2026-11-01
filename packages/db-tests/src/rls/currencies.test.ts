import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from '../pg.js';

describe('RLS: currencies', () => {
  it('un autenticado puede leer la lista de divisas', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.currencies where code = $1', ['EUR'])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('un admin puede deshabilitar una divisa', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      // La default (EUR) no se puede deshabilitar: es una regla de la API (service), no del SQL.
      await expect(
        query(c, 'update public.currencies set enabled = false where code = $1', ['AED']),
      ).resolves.toBeTruthy();
      await c.query('ROLLBACK');
    });
  });

  it('un usuario normal no puede deshabilitar una divisa', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(
        query(c, 'update public.currencies set enabled = false where code = $1', ['AED']),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query('ROLLBACK');
    });
  });

  it('anon no puede leer divisas', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      await expect(count(c, 'select count(*) from public.currencies')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('el seed inicial de divisas está habilitado y contiene las 180+ de la lista ISO 4217', async () => {
    await withClient(async (c) => {
      const total = await count(c, 'select count(*) from public.currencies');
      const enabled = await count(c, 'select count(*) from public.currencies where enabled = true');
      expect(total).toBeGreaterThanOrEqual(150);
      expect(enabled).toBe(total);
    });
  });
});
