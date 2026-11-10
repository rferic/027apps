import { Pool } from "pg";
import { healthResponse, probeDatabase } from "@/lib/health";

/**
 * GET /api/health — public liveness probe used by the keep-alive and the
 * deploy pipeline. It answers from Postgres through a tiny pool instead of the
 * Auth admin API, so the check is one round trip and reflects the database.
 *
 * The pool is module-level: warm invocations reuse the connection, and a cold
 * one pays a single handshake with a 2 s ceiling.
 */
let pool: Pool | null = null;

function databasePool(connectionString: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function GET() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return healthResponse(false);
  return healthResponse(await probeDatabase({ connect: () => databasePool(url).connect() }));
}
