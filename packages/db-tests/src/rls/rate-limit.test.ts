import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, createTestUser } from '../pg.js';

describe('RLS: rate_limit_counters', () => {
  it('an authenticated user cannot read the counters', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.rate_limit_counters')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('an authenticated user cannot insert into the counters', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(
        query(c, `insert into public.rate_limit_counters (key, window_start, expires_at)
                  values ('test', now(), now() + interval '1 minute')`),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query('ROLLBACK');
    });
  });

  it('an admin cannot either (the table is server-only, service_role)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.rate_limit_counters')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('service_role can read and write (atomic rate limiter upsert)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, `set local role service_role`);
      // service_role bypasses RLS, but the GRANTs must exist.
      await expect(
        query(c, `insert into public.rate_limit_counters (key, window_start, count, expires_at)
                  values ('test-key', date_trunc('minute', now()), 1, now() + interval '1 minute')
                  on conflict (key, window_start) do update set count = public.rate_limit_counters.count + 1
                  returning count`),
      ).resolves.toBeTruthy();
      await c.query('ROLLBACK');
    });
  });
});
