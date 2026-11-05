import { Pool } from "pg";
import { connection } from "next/server";
import { createPostgresRateLimitStorage } from "@027apps/core/api/rate-limit-storage.js";
import { withDoor } from "@027apps/core/api/door.js";
import { serializeLog } from "@027apps/core/logger.js";
import type { LogEntry } from "@027apps/core/api/types.js";
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
 *
 * Credentials are read lazily (first request): Next.js imports route modules
 * during `next build` ("collecting page data") and may prerender `GET`
 * handlers, where runtime env vars are absent. `connection()` marks every
 * handler that reaches the door as request-time only, so the singletons are
 * created on first use (fail-closed at request time, never at build time).
 */

async function createInfra() {
  // Prerendering stops here: the door always runs on an incoming request.
  await connection();

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
    throw new Error("Supabase credentials are not configured (NEXT_PUBLIC_*, SERVICE_ROLE, DB_URL)");
  }

  /** Service role pool for the rate-limit counter table (RLS-bypassing writes). */
  const pool = new Pool({ connectionString: SUPABASE_DB_URL, max: 5 });

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
  const rawEncryption = SETTINGS_ENCRYPTION_KEY ? createSettingsEncryption(SETTINGS_ENCRYPTION_KEY) : null;
  // A malformed master key yields a port whose methods always return null:
  // probing it keeps /health truthful (degraded) instead of reporting ok.
  const encryption =
    rawEncryption && (await rawEncryption.encrypt("027apps-canary", "health")) !== null ? rawEncryption : null;
  const settingsDeps: SettingsDeps = {
    db: {
      async query(sql: string, params: unknown[] = []) {
        const result = await pool.query(sql, params);
        return { rows: result.rows as Record<string, unknown>[] };
      },
    },
    encryption,
    currencies: {
      async isEnabled(code: string) {
        const result = await pool.query("select enabled from public.currencies where code = $1", [code]);
        return result.rows[0]?.enabled === true;
      },
    },
    withTransaction: runInTransaction,
  };

  /** Currencies service deps: real DB port + default currency from settings. */
  const currenciesDeps: CurrenciesDeps = {
    db: {
      async query(sql: string, params: unknown[] = []) {
        const result = await pool.query(sql, params);
        return { rows: result.rows as Record<string, unknown>[] };
      },
    },
    defaultCurrency: async () => {
      const result = await pool.query("select value from public.settings where key = 'localization.default_currency'");
      return result.rows[0] ? (result.rows[0].value as string) : null;
    },
    withTransaction: runInTransaction,
  };

  return { pool, auth, deps, settingsDeps, currenciesDeps };
}

let infra: Awaited<ReturnType<typeof createInfra>> | null = null;

/** Lazily created infrastructure singletons; credentials are validated on first use. */
export async function getInfra() {
  if (!infra) infra = await createInfra();
  return infra;
}

/** Reads the profile role and active state directly from the database. */
function createProfilesPort(poolInstance: Pool): ProfilesPort {
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
      return row?.active === true;
    },
  };
}

function logger(entry: LogEntry): void {
  // One-line JSON, stable keys, correlation only (no PII, no bodies).
  console.log(
    serializeLog({
      ts: new Date().toISOString(),
      level: entry.level,
      msg: entry.message,
      request_id: entry.requestId,
      ...(entry.route ? { route: entry.route } : {}),
      ...(entry.status !== undefined ? { status: entry.status } : {}),
      ...(entry.durationMs !== undefined ? { duration_ms: entry.durationMs } : {}),
      ...(entry.actor ? { actor: entry.actor } : {}),
      ...(entry.code ? { code: entry.code } : {}),
    }),
  );
}

/**
 * Runs a unit of work inside a real transaction on one pooled client
 * (BEGIN/COMMIT; ROLLBACK and rethrow on error). This is the runner injected
 * into the settings and currencies services, so their check-then-write
 * sequences are atomic in production and not only under the test harnesses.
 */
async function runInTransaction<T>(
  fn: (db: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>,
): Promise<T> {
  const { pool } = await getInfra();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn({
      async query(sql: string, params: unknown[] = []) {
        const res = await client.query(sql, params);
        return { rows: res.rows as Record<string, unknown>[] };
      },
    });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Acquires a persistent client from the pool and binds the `db.query` port to
 * it, so a transaction (BEGIN/COMMIT) runs on the same connection.
 */
export async function withTransactionClient<T>(
  fn: (db: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }) => Promise<T>,
): Promise<T> {
  const { pool } = await getInfra();
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

export { withDoor };
