import { describe, it, expect, afterAll } from 'vitest';
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from '../pg.js';

const createdUsers: string[] = [];

async function seedTwoUsers(role: 'super_admin' | 'admin' | 'user' = 'user') {
  return withClient(async (c) => {
    await c.query('BEGIN');
    const a = await createTestUser(c, { email: `a-${Date.now()}-@test.local`, role, displayName: 'User A' });
    const b = await createTestUser(c, { email: `b-${Date.now()}-@test.local`, role, displayName: 'User B' });
    await c.query('COMMIT');
    createdUsers.push(a.id, b.id);
    return { a, b };
  });
}

describe('RLS: profiles', () => {
  it('a user cannot read another user row', async () => {
    const { a, b } = await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(0);
      // The user can see their own row.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('a user cannot escalate their role (column grant)', async () => {
    const { a } = await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(
        query(c, 'update public.profiles set role = $1 where id = $2', ['super_admin', a.id]),
      ).rejects.toThrowError(/permission denied|column "role"/i);
      await c.query('ROLLBACK');
    });
  });

  it('a user cannot edit their deactivated_at (column grant)', async () => {
    const { a } = await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(
        query(c, 'update public.profiles set deactivated_at = now() where id = $1', [a.id]),
      ).rejects.toThrowError(/permission denied|column "deactivated_at"/i);
      await c.query('ROLLBACK');
    });
  });

  it('a user can edit their display_name/locale/timezone (column grant)', async () => {
    const { a } = await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(
        query(c, 'update public.profiles set display_name = $1, locale = $2, timezone = $3 where id = $4', [
          'New Name', 'es', 'Europe/Madrid', a.id,
        ]),
      ).resolves.toBeTruthy();
      const { rows } = await query(c, 'select display_name, locale from public.profiles where id = $1', [a.id]);
      expect(rows[0]).toMatchObject({ display_name: 'New Name', locale: 'es' });
      await c.query('ROLLBACK');
    });
  });

  it('an admin can read all profiles', async () => {
    const { a, b } = await seedTwoUsers('admin');
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('a deactivated admin loses admin status and can only see themselves', async () => {
    const { a, b } = await seedTwoUsers('admin');
    // Deactivate "a" as superuser (the real API performs this change with service_role).
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, 'update public.profiles set deactivated_at = now() where id = $1', [a.id]);
      await impersonate(c, a.id);
      // No longer an admin: cannot see the other active admin row.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(0);
      // Can only see themselves.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      // core_is_admin() no longer grants full visibility.
      await expect(query(c, 'select public.core_is_admin()')).resolves.toEqual({ rows: [{ core_is_admin: false }] });
      await c.query('ROLLBACK');
    });
    // An active admin (b) can see the deactivated one (a) so it can be reactivated.
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, 'update public.profiles set deactivated_at = now() where id = $1', [a.id]);
      await impersonate(c, b.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('anon cannot read anything', async () => {
    await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      await expect(count(c, 'select count(*) from public.profiles')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('role helpers are not executable by anon', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      // SAVEPOINT: each failed call aborts the transaction; isolate it so the
      // second assertion does not inherit the "transaction is aborted" error.
      await c.query('SAVEPOINT sp1');
      await expect(query(c, 'select public.core_is_admin()')).rejects.toThrowError(/permission denied/i);
      await c.query('ROLLBACK TO SAVEPOINT sp1');
      await c.query('SAVEPOINT sp2');
      await expect(query(c, 'select public.core_is_super_admin()')).rejects.toThrowError(/permission denied/i);
      await c.query('ROLLBACK TO SAVEPOINT sp2');
      await c.query('ROLLBACK');
    });
  });
});

afterAll(async () => {
  if (createdUsers.length > 0) {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, 'delete from public.profiles where id = any($1::uuid[])', [createdUsers]);
      await query(c, 'delete from auth.users where id = any($1::uuid[])', [createdUsers]);
      await c.query('COMMIT');
    });
  }
});
