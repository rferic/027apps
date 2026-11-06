import { describe, expect, it, vi } from 'vitest';
import { recordJwtExpiry, writeSettings, type SettingsDeps, type TransactionRunner } from './service.js';
import type { QueryClient } from '../api/rate-limit-storage.js';

const CALLER = { kind: 'session', userId: 'u1', role: 'super_admin' } as const;
const UPDATED_AT = '2025-01-01T00:00:00Z';

const CATALOG_KEYS = [
  'instance.name',
  'instance.public_url',
  'localization.default_locale',
  'localization.timezone',
  'localization.default_currency',
  'localization.enabled_locales',
  'notifications.push.provider',
  'notifications.push.fcm_project_id',
  'notifications.push.fcm_app_id',
  'notifications.push.fcm_api_key',
  'notifications.push.fcm_sender_id',
  'notifications.push.fcm_service_account',
];

type FakeRow = {
  value: unknown;
  encrypted: string | null;
  updatedBy: string | null;
  updatedAt: string;
};

type MakeDepsOptions = {
  /** 1-based index of the UPDATE that throws, simulating a mid-batch failure. */
  failOnUpdate?: number;
};

function makeDeps(initial: Record<string, unknown> = {}, options: MakeDepsOptions = {}) {
  const rows = new Map<string, FakeRow>(
    CATALOG_KEYS.map((key) => [
      key,
      { value: initial[key] ?? null, encrypted: null, updatedBy: null, updatedAt: UPDATED_AT },
    ]),
  );

  let updateCount = 0;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('update public.settings')) {
      updateCount += 1;
      if (options.failOnUpdate === updateCount) {
        throw new Error('simulated write failure');
      }
      const [stored, updatedBy, , key] = params;
      const row = rows.get(String(key));
      if (row) {
        if (sql.includes('value_encrypted')) row.encrypted = String(stored);
        else row.value = JSON.parse(String(stored));
        row.updatedBy = (updatedBy as string | null) ?? null;
        row.updatedAt = UPDATED_AT;
      }
      return { rows: [] };
    }
    if (sql.includes('value_encrypted') && sql.includes('updated_at')) {
      return {
        rows: [...rows].map(([key, row]) => ({
          key,
          value: row.value,
          value_encrypted: row.encrypted,
          updated_by: row.updatedBy,
          updated_at: row.updatedAt,
        })),
      };
    }
    if (sql.includes('value_encrypted')) {
      return {
        rows: [...rows].map(([key, row]) => ({
          key,
          value: row.value,
          value_encrypted: row.encrypted,
        })),
      };
    }
    return { rows: [] };
  });

  let transactionCalls = 0;
  const withTransaction: TransactionRunner = async (fn) => {
    transactionCalls += 1;
    // Real runner semantics: restore the pre-transaction state on failure.
    const before = new Map([...rows].map(([key, row]) => [key, { ...row }]));
    try {
      return await fn({ query });
    } catch (err) {
      rows.clear();
      for (const [key, row] of before) rows.set(key, row);
      throw err;
    }
  };
  const encryption = {
    encrypt: vi.fn(async () => 'encrypted-value'),
    decrypt: vi.fn(async () => null),
  };

  const deps: SettingsDeps = {
    db: { query: query as QueryClient['query'] },
    withTransaction,
    encryption,
    currencies: { isEnabled: async () => true },
  };

  const updateCalls = () =>
    query.mock.calls.filter((c) => String(c[0]).startsWith('update public.settings'));

  const values = () => Object.fromEntries([...rows].map(([key, row]) => [key, row.value]));

  return {
    deps,
    query,
    transactionCount: () => transactionCalls,
    encryption,
    updateCalls,
    values,
  };
}

const FCM_SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'my-project',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...',
  client_email: 'x@y.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
  client_id: '123',
});

describe('recordJwtExpiry', () => {
  it('writes the observed expiry with the admin as the audit actor', async () => {
    const query = vi.fn(async () => ({ rows: [] }));

    await recordJwtExpiry({ query }, 'admin-1', 900);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('update public.settings'), [
      JSON.stringify(900),
      'admin-1',
      'security.jwt_expiry',
    ]);
  });
});

describe('writeSettings', () => {
  it('rejects duplicate keys before touching the transaction', async () => {
    const { deps, transactionCount, updateCalls } = makeDeps();

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'instance.name', value: 'first' },
        { key: 'instance.name', value: 'second' },
      ]),
    ).rejects.toMatchObject({
      code: 'validation_failed',
      message: 'Duplicate key',
      details: { key: 'instance.name' },
    });

    expect(transactionCount()).toBe(0);
    expect(updateCalls()).toHaveLength(0);
  });

  it('returns not_found for a key outside the catalog without writing', async () => {
    const { deps, transactionCount, updateCalls } = makeDeps();

    await expect(
      writeSettings(deps, CALLER, [{ key: 'module.missing', value: 'x' }]),
    ).rejects.toMatchObject({ code: 'not_found' });

    expect(transactionCount()).toBe(0);
    expect(updateCalls()).toHaveLength(0);
  });

  it('writes nothing when any value fails schema validation', async () => {
    const { deps, transactionCount, updateCalls } = makeDeps();

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'instance.name', value: 'changed' },
        { key: 'localization.timezone', value: 'Mars/Olympus' },
      ]),
    ).rejects.toMatchObject({
      code: 'validation_failed',
      message: 'Validation failed',
      details: { key: 'localization.timezone' },
    });

    expect(transactionCount()).toBe(0);
    expect(updateCalls()).toHaveLength(0);
  });

  it('writes nothing when the batch breaks coherence', async () => {
    const { deps, transactionCount, updateCalls } = makeDeps();

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'instance.name', value: 'changed' },
        { key: 'notifications.push.provider', value: 'fcm' },
      ]),
    ).rejects.toMatchObject({ code: 'validation_failed' });

    expect(transactionCount()).toBe(1);
    expect(updateCalls()).toHaveLength(0);
  });

  it('writes a coherent FCM batch in one transaction and returns the input order', async () => {
    const { deps, transactionCount, updateCalls } = makeDeps();

    const updates = [
      { key: 'notifications.push.provider', value: 'fcm' },
      { key: 'notifications.push.fcm_service_account', value: FCM_SERVICE_ACCOUNT },
      { key: 'notifications.push.fcm_sender_id', value: '123' },
      { key: 'notifications.push.fcm_project_id', value: 'my-project' },
      { key: 'notifications.push.fcm_api_key', value: 'AIzaSy...' },
      { key: 'notifications.push.fcm_app_id', value: '1:123:web:abc' },
    ];

    const result = await writeSettings(deps, CALLER, updates);

    expect(result.map((setting) => setting.key)).toEqual(updates.map((update) => update.key));
    expect(transactionCount()).toBe(1);
    expect(updateCalls()).toHaveLength(updates.length);
  });

  it('encrypts a secret and never exposes its plaintext in the view', async () => {
    const { deps, encryption, updateCalls } = makeDeps({
      'notifications.push.fcm_project_id': 'my-project',
    });

    const result = await writeSettings(deps, CALLER, [
      { key: 'notifications.push.fcm_service_account', value: FCM_SERVICE_ACCOUNT },
    ]);

    expect(encryption.encrypt).toHaveBeenCalledWith(
      FCM_SERVICE_ACCOUNT,
      'notifications.push.fcm_service_account',
    );
    expect(updateCalls()[0]?.[0]).toContain('value_encrypted = $1');
    expect(result).toHaveLength(1);
    expect(result[0]?.configured).toBe(true);
    expect(result[0]?.value).toBeUndefined();
  });

  it('rejects a non-JSON service account as validation_failed instead of throwing', async () => {
    const { deps, updateCalls } = makeDeps();

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'notifications.push.fcm_service_account', value: 'no-es-json' },
      ]),
    ).rejects.toMatchObject({
      code: 'validation_failed',
      message: 'Validation failed',
      details: { key: 'notifications.push.fcm_service_account' },
    });

    expect(updateCalls()).toHaveLength(0);
  });

  it('fails before the first write when a secret cannot be encrypted', async () => {
    const { deps, updateCalls } = makeDeps({
      'notifications.push.fcm_project_id': 'my-project',
    });
    // Degraded instance: no encryption key configured.
    deps.encryption = null;
    // Worst case: a runner that does not roll back must still see zero writes.
    deps.withTransaction = (fn) => fn(deps.db);

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'instance.name', value: 'changed' },
        { key: 'notifications.push.fcm_service_account', value: FCM_SERVICE_ACCOUNT },
      ]),
    ).rejects.toMatchObject({ code: 'internal' });

    expect(updateCalls()).toHaveLength(0);
  });

  it('rolls back earlier writes when a mid-batch write fails', async () => {
    const { deps, updateCalls, values } = makeDeps(
      { 'instance.name': 'original', 'localization.timezone': 'UTC' },
      { failOnUpdate: 2 },
    );

    await expect(
      writeSettings(deps, CALLER, [
        { key: 'instance.name', value: 'changed' },
        { key: 'localization.timezone', value: 'Europe/Madrid' },
      ]),
    ).rejects.toThrow('simulated write failure');

    expect(updateCalls()).toHaveLength(2);
    expect(values()).toMatchObject({
      'instance.name': 'original',
      'localization.timezone': 'UTC',
    });
  });
});
