import { Pool } from "pg";
import { createPostgresRateLimitStorage } from "@027apps/core/api/rate-limit-storage.js";
import { withDoor } from "@027apps/core/api/door.js";
import type { DoorDeps } from "@027apps/core/api/types.js";
import { resolveCaller, type CallerResolverDeps, type ProfilesPort } from "@027apps/core/auth/caller.js";
import { createSettingsEncryption } from "@027apps/core/crypto.js";
import type { SettingsDeps } from "@027apps/core/settings/service.js";
import type { CurrenciesDeps } from "@027apps/core/currencies/service.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Junction between the core door and real infrastructure: session resolver
 * (JWT verified with `getUser`) + Postgres rate-limit storage + JSON logger.
 * Every route handler under `/api/v1/**` uses this helper as its entry point.
 *
 * The `pg` pool is connected to the Supabase database (DB URL). In Vercel
 * deployment it must be the pooled connection string (port 6543). It is only
 * used for `rate_limit_counters` (service-internal table, bypasses RLS).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  throw new Error("Supabase credentials are not configured (NEXT_PUBLIC_*, SERVICE_ROLE, DB_URL)");
}

/** Service role pool for the rate-limit counter table (RLS-bypassing writes). */
const pool = new Pool({ connectionString: SUPABASE_DB_URL, max: 5 });

/** Reads the profile role and active state directly from the database. */
export function createProfilesPort(poolInstance: Pool): ProfilesPort {
  return {
    async getRole(userId: string) {
      const { rows } = await poolInstance.query(
        "SELECT role FROM public.profiles WHERE id = $1 AND deactivated_at IS NULL",
        [userId],
      );
      const row = rows[0] as { role: string } | undefined;
      return (row?.role as "super_admin" | "admin" | "user") ?? null;
    },
    async isActive(userId: string) {
      const { rows } = await poolInstance.query(
        "SELECT deactivated_at IS NULL AS active FROM public.profiles WHERE id = $1",
        [userId],
      );
      const row = rows[0] as { active: boolean } | undefined;
      return row?.active ?? false;
    },
  };
}

function logger(entry: { message: string; level: string; requestId: string }) {
  // JSON one-liner: correlation only (no PII, no bodies). Replaced in task-06
  // with the structured logger.
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level: entry.level, request_id: entry.requestId, msg: entry.message }),
  );
}

const sessionClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const auth = async (req: Request) => {
  const resolverDeps: CallerResolverDeps = {
    supabase: {
      async getUser(jwt: string) {
        const { data, error } = await sessionClient.auth.getUser(jwt);
        return {
          data: { user: data.user ? { id: data.user.id, email: data.user.email ?? null } : null },
          error: error ? { message: error.message } : null,
        };
      },
    },
    profiles: createProfilesPort(pool),
  };
  return resolveCaller(req, resolverDeps);
};

const deps: DoorDeps = {
  rateLimitStorage: createPostgresRateLimitStorage({
    async query(sql: string, params: unknown[]) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  }),
  logger,
};

/** Settings service deps: real DB port + encryption key (null = degraded). */
const SETTINGS_ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY;
export const settingsDeps: SettingsDeps = {
  db: {
    async query(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  },
  encryption: SETTINGS_ENCRYPTION_KEY ? createSettingsEncryption(SETTINGS_ENCRYPTION_KEY) : null,
  currencies: {
    async isEnabled(code: string) {
      const result = await pool.query("select enabled from public.currencies where code = $1", [code]);
      return result.rows[0]?.enabled === true;
    },
  },
};

/** Currencies service deps: real DB port + default currency from settings. */
export const currenciesDeps: CurrenciesDeps = {
  db: {
    async query(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as Record<string, unknown>[] };
    },
  },
  defaultCurrency: async () => {
    const result = await pool.query(
      "select value from public.settings where key = 'localization.default_currency'",
    );
    return result.rows[0] ? (result.rows[0].value as string) : null;
  },
};

/**
 * Acquires a persistent client from the pool and binds the `db.query` port to
 * it, so a transaction (BEGIN/COMMIT) runs on the same connection.
 */
export async function withTransactionClient<T>(
  fn: (db: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn({
      async query(sql: string, params: unknown[] = []) {
        const res = await client.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    });
  } finally {
    client.release();
  }
}

export { withDoor, deps, auth };
