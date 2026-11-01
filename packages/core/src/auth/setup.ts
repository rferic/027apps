/**
 * Setup: atomic creation of the first super_admin (ADR 0004 / core-api spec).
 *
 * The Auth user is created first; a database transaction then takes an
 * advisory lock, re-checks `requires_setup` (no ACTIVE super_admin) and
 * inserts the profile with `role='super_admin'`. If the transaction fails the
 * Auth user is deleted so no orphan is left. Re-running after a successful
 * setup → 409 `already_setup`, never leaking who was created. Counting only
 * active super_admins matches /instance's `requires_setup`: if the sole
 * super_admin is deactivated, setup is allowed again as a recovery path.
 */

import { DomainError } from '../errors';

export interface SetupDeps {
  auth: {
    createUser(email: string, password: string): Promise<{ userId: string }>;
    deleteUser(userId: string): Promise<void>;
  };
  db: {
    query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
}

export interface SetupInput {
  email: string;
  password: string;
  displayName: string;
}

export async function createFirstSuperAdmin(
  deps: SetupDeps,
  input: SetupInput,
): Promise<{ userId: string; email: string }> {
  const { userId } = await deps.auth.createUser(input.email, input.password);

  await deps.db.query('BEGIN');
  try {
    await deps.db.query("SELECT pg_advisory_xact_lock(hashtext('core_setup'))");

    const existing = await deps.db.query(
      'SELECT id FROM public.profiles WHERE role = $1 AND deactivated_at IS NULL LIMIT 1',
      ['super_admin'],
    );
    if (existing.rows.length > 0) {
      throw new DomainError('already_setup');
    }

    await deps.db.query(
      `INSERT INTO public.profiles (id, display_name, role)
       VALUES ($1, $2, 'super_admin')`,
      [userId, input.displayName],
    );

    await deps.db.query('COMMIT');
    return { userId, email: input.email };
  } catch (err) {
    await deps.db.query('ROLLBACK').catch(() => undefined);
    await deps.auth.deleteUser(userId).catch(() => undefined);
    throw err;
  }
}
