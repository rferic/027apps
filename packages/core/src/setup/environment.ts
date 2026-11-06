/**
 * Setup wizard, step 1: environment verification (instance-config spec §2/§7.2).
 *
 * The wizard only *guides and verifies* what lives outside the database
 * (hosting env and the Supabase project). Nothing here writes settings and no
 * secret value is ever returned: checks report `ok`/`missing`/`failed` plus a
 * human hint.
 */

/** Tables whose presence means the migrations ran (0001–0004). */
const REQUIRED_TABLES = [
  'profiles',
  'settings',
  'settings_categories',
  'currencies',
  'rate_limit_counters',
] as const;

export type CheckStatus = 'ok' | 'missing' | 'failed';

export type EnvironmentCheck = {
  key: 'database' | 'migrations' | 'encryption_key' | 'sentry';
  status: CheckStatus;
  hint: string;
};

export type EnvironmentReport = {
  /** Everything required to install is in place (Sentry is optional). */
  ready: boolean;
  checks: EnvironmentCheck[];
};

export interface EnvironmentDeps {
  db: { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> };
  /** `SETTINGS_ENCRYPTION_KEY`: must be present and decode to 32 bytes. */
  encryptionKey: { present: boolean; valid: boolean };
  /** `SENTRY_DSN` is optional: without it the instance works, without aggregation. */
  sentryConfigured: boolean;
}

async function databaseReachable(deps: EnvironmentDeps): Promise<boolean> {
  try {
    await deps.db.query('select 1');
    return true;
  } catch {
    return false;
  }
}

async function migrationsApplied(deps: EnvironmentDeps): Promise<boolean> {
  try {
    const { rows } = await deps.db.query(
      'select table_name from information_schema.tables where table_schema = $1 and table_name = any($2::text[])',
      ['public', REQUIRED_TABLES],
    );
    return rows.length === REQUIRED_TABLES.length;
  } catch {
    return false;
  }
}

function encryptionKeyCheck(deps: EnvironmentDeps): EnvironmentCheck {
  if (!deps.encryptionKey.present) {
    return {
      key: 'encryption_key',
      status: 'missing',
      hint: 'Add SETTINGS_ENCRYPTION_KEY (base64 of 32 bytes) to the hosting environment and redeploy.',
    };
  }
  if (!deps.encryptionKey.valid) {
    return {
      key: 'encryption_key',
      status: 'failed',
      hint: 'SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate a new one and redeploy.',
    };
  }
  return { key: 'encryption_key', status: 'ok', hint: '32-byte key detected.' };
}

/** Verifies the environment the wizard cannot write: DB, migrations, key, Sentry. */
export async function checkEnvironment(deps: EnvironmentDeps): Promise<EnvironmentReport> {
  const reachable = await databaseReachable(deps);
  const migrated = reachable ? await migrationsApplied(deps) : false;

  const checks: EnvironmentCheck[] = [
    reachable
      ? { key: 'database', status: 'ok', hint: 'Connected to the Supabase database.' }
      : {
          key: 'database',
          status: 'failed',
          hint: 'Cannot reach the database. Check SUPABASE_DB_URL and that the Supabase project is up.',
        },
    migrated
      ? { key: 'migrations', status: 'ok', hint: `All ${REQUIRED_TABLES.length} core tables exist.` }
      : {
          key: 'migrations',
          status: reachable ? 'missing' : 'failed',
          hint: 'Apply the migrations (supabase db push) before installing.',
        },
    encryptionKeyCheck(deps),
    deps.sentryConfigured
      ? { key: 'sentry', status: 'ok', hint: 'Error reporting is configured.' }
      : { key: 'sentry', status: 'missing', hint: 'Optional: add SENTRY_DSN to report server errors.' },
  ];

  const ready = checks
    .filter((check) => check.key !== 'sentry')
    .every((check) => check.status === 'ok');

  return { ready, checks };
}
