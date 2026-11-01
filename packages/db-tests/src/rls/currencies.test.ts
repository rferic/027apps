import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from '../pg.js';

describe('RLS: currencies', () => {
  it('an authenticated user can read the currency list', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.currencies where code = $1', ['EUR'])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('an admin can disable a currency', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      // The default currency (EUR) cannot be disabled: that is an API rule (service), not SQL.
      await expect(
        query(c, 'update public.currencies set enabled = false where code = $1', ['AED']),
      ).resolves.toBeTruthy();
      await c.query('ROLLBACK');
    });
  });

  it('a regular user cannot disable a currency', async () => {
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

  it('anon cannot read currencies', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      await expect(count(c, 'select count(*) from public.currencies')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('the initial currency seed is enabled and contains the ISO 4217 list', async () => {
    await withClient(async (c) => {
      const total = await count(c, 'select count(*) from public.currencies');
      const enabled = await count(c, 'select count(*) from public.currencies where enabled = true');
      expect(total).toBeGreaterThanOrEqual(150);
      expect(enabled).toBe(total);
    });
  });
});
