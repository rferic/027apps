import { Pool } from "pg";
import { hasActiveSuperAdmin, isSetupIncomplete } from "@027apps/core/instance/api.js";
import type { SettingsDeps } from "@027apps/core/settings/service.js";

/**
 * Instance state for the proxy gate, which runs before every HTML render. The
 * positive (`installed`) answer is memoised for a few seconds to keep the gate
 * off the database on every request; the negative answer is never cached, so
 * the first render after the wizard creates the admin already sees it.
 */
const POSITIVE_TTL_MS = 5_000;

export interface InstanceState {
  /** An active super_admin exists (wizard steps 1–2 are done). */
  installed: boolean;
  /** An admin exists but the required preferences are missing (steps 3–5). */
  setupIncomplete: boolean;
}

let pool: Pool | null = null;
let positiveUntil = 0;
let lastState: InstanceState = { installed: false, setupIncomplete: false };

function getPool(): Pool {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not configured");
  pool ??= new Pool({ connectionString: url, max: 2 });
  return pool;
}

/** Minimal `SettingsDeps` for the shared instance predicates. */
function settingsDeps(): SettingsDeps {
  return {
    db: {
      async query(sql: string, params: unknown[] = []) {
        const result = await getPool().query(sql, params);
        return { rows: result.rows as Record<string, unknown>[] };
      },
    },
    encryption: null,
    currencies: { isEnabled: async () => false },
  };
}

/** Current instance state, memoised for a few seconds once an admin exists. */
export async function readInstanceState(): Promise<InstanceState> {
  const now = Date.now();
  if (now < positiveUntil) return lastState;

  const deps = settingsDeps();
  if (!(await hasActiveSuperAdmin(deps))) {
    lastState = { installed: false, setupIncomplete: false };
    return lastState;
  }

  lastState = { installed: true, setupIncomplete: await isSetupIncomplete(deps) };
  positiveUntil = now + POSITIVE_TTL_MS;
  return lastState;
}
