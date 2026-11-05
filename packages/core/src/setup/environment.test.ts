import { describe, expect, it, vi } from 'vitest';
import { checkEnvironment, type EnvironmentDeps } from './environment.js';

const TABLES = ['profiles', 'settings', 'settings_categories', 'currencies', 'rate_limit_counters'];

/** Fake database: `tables` are the ones `information_schema` reports. */
function depsWith(options: {
  reachable?: boolean;
  tables?: string[];
  encryptionKey?: { present: boolean; valid: boolean };
  sentryConfigured?: boolean;
}): EnvironmentDeps {
  const reachable = options.reachable ?? true;
  const tables = options.tables ?? TABLES;
  return {
    db: {
      query: vi.fn(async (sql: string) => {
        if (!reachable) throw new Error('connection refused');
        if (sql.includes('information_schema')) return { rows: tables.map((table_name) => ({ table_name })) };
        return { rows: [{}] };
      }),
    },
    encryptionKey: options.encryptionKey ?? { present: true, valid: true },
    sentryConfigured: options.sentryConfigured ?? false,
  };
}

function statusOf(report: Awaited<ReturnType<typeof checkEnvironment>>, key: string) {
  return report.checks.find((check) => check.key === key)?.status;
}

describe('checkEnvironment', () => {
  it('is ready when the database, migrations and key are ok (Sentry is optional)', async () => {
    const report = await checkEnvironment(depsWith({}));

    expect(report.ready).toBe(true);
    expect(statusOf(report, 'database')).toBe('ok');
    expect(statusOf(report, 'migrations')).toBe('ok');
    expect(statusOf(report, 'encryption_key')).toBe('ok');
    expect(statusOf(report, 'sentry')).toBe('missing');
  });

  it('fails everything database-dependent when the database is unreachable', async () => {
    const report = await checkEnvironment(depsWith({ reachable: false }));

    expect(report.ready).toBe(false);
    expect(statusOf(report, 'database')).toBe('failed');
    expect(statusOf(report, 'migrations')).toBe('failed');
  });

  it('reports missing migrations when a core table is absent', async () => {
    const report = await checkEnvironment(depsWith({ tables: ['profiles', 'settings'] }));

    expect(report.ready).toBe(false);
    expect(statusOf(report, 'migrations')).toBe('missing');
    expect(statusOf(report, 'database')).toBe('ok');
  });

  it('blocks the install when the encryption key is missing', async () => {
    const report = await checkEnvironment(
      depsWith({ encryptionKey: { present: false, valid: false } }),
    );

    expect(report.ready).toBe(false);
    expect(statusOf(report, 'encryption_key')).toBe('missing');
  });

  it('blocks the install when the encryption key is not 32 bytes', async () => {
    const report = await checkEnvironment(depsWith({ encryptionKey: { present: true, valid: false } }));

    expect(report.ready).toBe(false);
    expect(statusOf(report, 'encryption_key')).toBe('failed');
  });

  it('never returns secret values, only statuses and hints', async () => {
    const report = await checkEnvironment(depsWith({ sentryConfigured: true }));
    const serialized = JSON.stringify(report);

    expect(serialized).not.toMatch(/SETTINGS_ENCRYPTION_KEY=/);
    expect(statusOf(report, 'sentry')).toBe('ok');
  });
});
