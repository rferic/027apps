import { describe, it, expect } from 'vitest';
import { withClient, query, count, impersonate, createTestUser } from '../pg.js';

describe('RLS: rate_limit_counters', () => {
  it('un autenticado no puede leer los contadores', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `u-${Date.now()}@test.local`, role: 'user' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.rate_limit_counters')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('un autenticado no puede insertar en los contadores', async () => {
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

  it('un admin tampoco puede (la tabla es solo del servidor, service_role)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      const { id } = await createTestUser(c, { email: `a-${Date.now()}@test.local`, role: 'admin' });
      await impersonate(c, id);
      await expect(count(c, 'select count(*) from public.rate_limit_counters')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('service_role puede leer y escribir (upsert atómico del rate limiter)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, `set local role service_role`);
      // Service_role bypassea RLS, pero los GRANTs deben existir.
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
