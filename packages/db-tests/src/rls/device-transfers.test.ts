import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, createTestUser } from '../pg.js';

/**
 * The migration table holds a bearer code (hashed) for 60 seconds. Nothing but
 * the server may read or write it: `anon` and `authenticated` have no grant at
 * all (spec §11.2, task-10).
 */
describe('RLS: device_transfers', () => {
  it('an authenticated user cannot read the codes', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `m-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.device_transfers')).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query('ROLLBACK');
    });
  });

  it('an admin cannot insert one either', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `ma-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      await expect(
        query(
          c,
          `insert into public.device_transfers (user_id, code_hash, expires_at)
           values ($1, repeat('a', 64), now() + interval '60 seconds')`,
          [id],
        ),
      ).rejects.toThrowError(/permission denied/i);
      await c.query('ROLLBACK');
    });
  });

  it('service_role can mint and read a code', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `ms-${Date.now()}@test.local`, role: 'user' });
      await query(c, 'set local role service_role');
      await expect(
        query(
          c,
          `insert into public.device_transfers (user_id, code_hash, expires_at)
           values ($1, repeat('b', 64), now() + interval '60 seconds')
           returning id`,
          [id],
        ),
      ).resolves.toBeTruthy();
      await c.query('ROLLBACK');
    });
  });
});
