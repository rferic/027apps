import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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
  it('un usuario no puede leer la fila de otro', async () => {
    const { a, b } = await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(0);
      // El propio usuario sí se ve.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('un usuario no puede escalar su rol (column grant)', async () => {
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

  it('un usuario no puede editar su deactivated_at (column grant)', async () => {
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

  it('un usuario puede editarse display_name/locale/timezone (column grant)', async () => {
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

  it('un admin puede leer todos los perfiles', async () => {
    const { a, b } = await seedTwoUsers('admin');
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonate(c, a.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('un admin desactivado pierde su condición de admin y solo se ve a sí mismo', async () => {
    const { a, b } = await seedTwoUsers('admin');
    // Desactivamos a como superuser (la API real hace este cambio con service_role).
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, 'update public.profiles set deactivated_at = now() where id = $1', [a.id]);
      await impersonate(c, a.id);
      // Ya no es admin: no ve la fila del otro admin activo.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [b.id])).resolves.toBe(0);
      // Solo se ve a sí mismo.
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      // core_is_admin() ya no le deja ver todo.
      await expect(query(c, 'select public.core_is_admin()')).resolves.toEqual({ rows: [{ core_is_admin: false }] });
      await c.query('ROLLBACK');
    });
    // Un admin activo (b) sí ve al desactivado (a) para poder reactivarlo.
    await withClient(async (c) => {
      await c.query('BEGIN');
      await query(c, 'update public.profiles set deactivated_at = now() where id = $1', [a.id]);
      await impersonate(c, b.id);
      await expect(count(c, 'select count(*) from public.profiles where id = $1', [a.id])).resolves.toBe(1);
      await c.query('ROLLBACK');
    });
  });

  it('anon no puede leer nada', async () => {
    await seedTwoUsers();
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      await expect(count(c, 'select count(*) from public.profiles')).resolves.toBe(0);
      await c.query('ROLLBACK');
    });
  });

  it('los helpers de rol no son ejecutables por anon', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      await impersonateAnon(c);
      // SAVEPOINT: cada llamada fallida aborta la transacción; se aísla para que
      // la segunda aserción no herede el error "transaction is aborted".
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
