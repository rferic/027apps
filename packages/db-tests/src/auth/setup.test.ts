import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client, type ClientBase } from 'pg';
import { dbUrl, query } from '../pg.js';
import { createFirstSuperAdmin, type SetupDeps } from '@027apps/core/auth/setup.js';

const EMAIL_PREFIX = 'setup-test-';

function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  return createClient(url, key);
}

function dbClient(): Client {
  return new Client({ connectionString: dbUrl() });
}

function makeDeps(db: ClientBase): SetupDeps {
  const supabase = adminClient();
  return {
    auth: {
      async createUser(email: string, password: string) {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
        return { userId: data.user.id };
      },
      async deleteUser(userId: string) {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) throw new Error(`deleteUser failed: ${error.message}`);
      },
    },
    db: {
      async query(sql: string, params?: unknown[]) {
        const res = await db.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    },
  };
}

/**
 * Real admins (not created by this suite) paused for the duration of the run.
 * `createFirstSuperAdmin` refuses while any *active* super_admin exists, so the
 * suite deactivates them instead of deleting them and restores them afterwards.
 */
const pausedAdmins = new Set<string>();

/** Removes this suite's users and pauses real admins (local stack only). */
async function cleanup() {
  // Never touch a non-local SUPABASE_DB_URL: a misconfigured environment must
  // not be able to pause or delete real admins.
  const url = process.env.SUPABASE_DB_URL;
  const isLocal = Boolean(url && (url.includes('127.0.0.1') || url.includes('localhost')));
  if (!isLocal) return;

  const db = dbClient();
  await db.connect();
  try {
    // Test profiles cascade away with their auth user (FK ON DELETE CASCADE).
    await db.query(`DELETE FROM auth.users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%`]);

    const { rows } = await query(
      db,
      "SELECT id FROM public.profiles WHERE role = 'super_admin' AND deactivated_at IS NULL",
    );
    const active = rows.map((row) => String(row.id));
    if (active.length > 0) {
      for (const id of active) pausedAdmins.add(id);
      console.warn(
        `[db-tests] pausing ${active.length} real super_admin(s) on the LOCAL stack; restored after the suite`,
      );
      await db.query('UPDATE public.profiles SET deactivated_at = now() WHERE id = ANY($1::uuid[])', [
        active,
      ]);
    }
  } finally {
    await db.end();
  }
}

/** Reactivates the real admins paused by `cleanup()` (never deletes them). */
async function restoreRealAdmins() {
  if (pausedAdmins.size === 0) return;
  const db = dbClient();
  await db.connect();
  try {
    await db.query('UPDATE public.profiles SET deactivated_at = NULL WHERE id = ANY($1::uuid[])', [
      [...pausedAdmins],
    ]);
    pausedAdmins.clear();
  } finally {
    await db.end();
  }
}

afterAll(async () => {
  try {
    await cleanup();
  } finally {
    await restoreRealAdmins();
  }
});

describe('createFirstSuperAdmin — local stack', () => {
  it('two concurrent installers → exactly one wins, the other gets already_setup', async () => {
    await cleanup();

    const a = dbClient();
    const b = dbClient();
    await Promise.all([a.connect(), b.connect()]);
    try {
      const results = await Promise.allSettled([
        createFirstSuperAdmin(makeDeps(a), {
          email: `${EMAIL_PREFIX}a@local.test`,
          password: 'test-password',
          displayName: 'Setup A',
        }),
        createFirstSuperAdmin(makeDeps(b), {
          email: `${EMAIL_PREFIX}b@local.test`,
          password: 'test-password',
          displayName: 'Setup B',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0].reason as { code: string }).code).toBe('already_setup');

      const { rows } = await query(
        a,
        "SELECT display_name FROM public.profiles WHERE role = 'super_admin' AND deactivated_at IS NULL",
      );
      expect(rows).toHaveLength(1);
      expect((rows[0] as { display_name: string }).display_name).toMatch(/^Setup [AB]$/);
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
  });

  it('after a successful setup, a second call returns already_setup without leaking data', async () => {
    await cleanup();
    const db = dbClient();
    await db.connect();
    try {
      const deps = makeDeps(db);
      const first = await createFirstSuperAdmin(deps, {
        email: `${EMAIL_PREFIX}first@local.test`,
        password: 'test-password',
        displayName: 'First Admin',
      });
      expect(first.email).toBe(`${EMAIL_PREFIX}first@local.test`);

      await expect(
        createFirstSuperAdmin(deps, {
          email: `${EMAIL_PREFIX}second@local.test`,
          password: 'test-password',
          displayName: 'Second Admin',
        }),
      ).rejects.toMatchObject({ code: 'already_setup' });
    } finally {
      await db.end();
    }
  });

  it('allows setup again when the only super_admin is deactivated (F-L)', async () => {
    await cleanup();
    const db = dbClient();
    await db.connect();
    try {
      const deps = makeDeps(db);
      const first = await createFirstSuperAdmin(deps, {
        email: `${EMAIL_PREFIX}deactivated@local.test`,
        password: 'test-password',
        displayName: 'Deactivated Admin',
      });
      await query(db, 'UPDATE public.profiles SET deactivated_at = now() WHERE id = $1', [first.userId]);

      // /instance advertises requires_setup again; setup must not dead-end in 409.
      const second = await createFirstSuperAdmin(deps, {
        email: `${EMAIL_PREFIX}recovery@local.test`,
        password: 'test-password',
        displayName: 'Recovery Admin',
      });
      expect(second.email).toBe(`${EMAIL_PREFIX}recovery@local.test`);

      const { rows } = await query(
        db,
        "SELECT id FROM public.profiles WHERE role = 'super_admin' AND deactivated_at IS NULL",
      );
      expect(rows).toHaveLength(1);
      expect((rows[0] as { id: string }).id).toBe(second.userId);
    } finally {
      await db.end();
    }
  });

  it('persists display_name and role; identity (email) lives in auth.users only', async () => {
    await cleanup();
    const db = dbClient();
    await db.connect();
    try {
      const { userId } = await createFirstSuperAdmin(makeDeps(db), {
        email: `${EMAIL_PREFIX}persist@local.test`,
        password: 'test-password',
        displayName: 'Persistent Admin',
      });

      const { rows } = await query(db, 'SELECT id, display_name, role FROM public.profiles WHERE id = $1', [userId]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ display_name: 'Persistent Admin', role: 'super_admin' });

      const auth = await query(db, 'SELECT email FROM auth.users WHERE id = $1', [userId]);
      expect((auth.rows[0] as { email: string }).email).toBe(`${EMAIL_PREFIX}persist@local.test`);
    } finally {
      await db.end();
    }
  });

  it('if the profile INSERT fails, the orphan Auth user is deleted', async () => {
    await cleanup();
    const db = dbClient();
    await db.connect();
    try {
      // A profile for the same id already exists → INSERT violates the PK.
      const existing = await adminClient().auth.admin.createUser({
        email: `${EMAIL_PREFIX}clash@local.test`,
        password: 'test-password',
        email_confirm: true,
      });
      const userId = existing.data.user!.id;
      await query(db, "INSERT INTO public.profiles (id, display_name, role) VALUES ($1, 'Clash', 'user')", [userId]);

      const deps = makeDeps(db);
      // The stubbed createUser returns the id that already has a profile.
      deps.auth.createUser = async () => ({ userId });

      await expect(
        createFirstSuperAdmin(deps, {
          email: `${EMAIL_PREFIX}clash@local.test`,
          password: 'test-password',
          displayName: 'Clash Admin',
        }),
      ).rejects.toThrow();

      // The auth user must be gone (cleanup). The profile cascades away with
      // it (FK ON DELETE CASCADE), which is the schema's own guarantee that no
      // partial setup state survives.
      const auth = await query(db, 'SELECT id FROM auth.users WHERE id = $1', [userId]);
      expect(auth.rows).toHaveLength(0);
      const profile = await query(db, 'SELECT role FROM public.profiles WHERE id = $1', [userId]);
      expect(profile.rows).toHaveLength(0);
      const admins = await query(
        db,
        "SELECT id FROM public.profiles WHERE role = 'super_admin' AND deactivated_at IS NULL",
      );
      expect(admins.rows).toHaveLength(0);
    } finally {
      await db.end();
    }
  });
});
