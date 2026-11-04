import { describe, expect, it } from 'vitest';
import type { ClientBase } from 'pg';
import { withClient, query, createTestUser } from '../pg.js';
import { createSettingsEncryption } from '@027apps/core/crypto.js';
import {
  computeHealth,
  readAllSettings,
  readPublicSettings,
  writeSetting,
  type SettingsDeps,
} from '@027apps/core/settings/service.js';
import { CATALOG_DEFAULTS, SETTINGS_CATALOG } from '@027apps/core/settings/catalog.js';
import type { Caller } from '@027apps/core/api/types.js';

/**
 * Settings service integration tests against the local Supabase stack
 * (task-04 §5/§6). Every test runs inside a transaction that is rolled back,
 * so the seeded settings survive unchanged. The encryption port uses a fixed
 * 32-byte test key: the production key never touches tests.
 */

const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

const ADMIN: Caller = { kind: 'session', userId: '00000000-0000-4000-8000-000000000001', role: 'admin' };
const SUPER_ADMIN: Caller = { kind: 'session', userId: '00000000-0000-4000-8000-000000000002', role: 'super_admin' };
const USER: Caller = { kind: 'session', userId: '00000000-0000-4000-8000-000000000003', role: 'user' };

function settingsDeps(c: ClientBase, encryption: SettingsDeps['encryption'] = createSettingsEncryption(TEST_KEY)): SettingsDeps {
  const db = {
    async query(sql: string, params: unknown[] = []) {
      return query(c, sql, params);
    },
  };
  let savepoint = 0;
  return {
    db,
    // The test already runs in a transaction; a savepoint gives the service a
    // real atomic boundary without committing the outer rollback wrapper.
    async withTransaction<T>(fn: (client: typeof db) => Promise<T>): Promise<T> {
      const name = `sp_settings_${++savepoint}`;
      await c.query(`SAVEPOINT ${name}`);
      try {
        const result = await fn(db);
        await c.query(`RELEASE SAVEPOINT ${name}`);
        return result;
      } catch (err) {
        await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
        throw err;
      }
    },
    encryption,
    currencies: {
      async isEnabled(code: string, client) {
        if (client) {
          const { rows } = await client.query('select enabled from public.currencies where code = $1', [code]);
          return rows[0]?.enabled === true;
        }
        const { rows } = await query(c, 'select enabled from public.currencies where code = $1', [code]);
        const row = rows[0] as { enabled: boolean } | undefined;
        return row?.enabled === true;
      },
    },
  };
}

/** Runs `fn` inside a transaction and always rolls back (seeded data untouched). */
async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query('BEGIN');
    try {
      await fn(c);
    } finally {
      await c.query('ROLLBACK');
    }
  });
}

const SERVICE_ACCOUNT = JSON.stringify({
  type: 'service_account',
  project_id: 'demo-project',
  private_key: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n',
  client_email: 'push@demo-project.iam.gserviceaccount.com',
  token_uri: 'https://oauth2.googleapis.com/token',
  client_id: '1234567890',
});

describe('settings service — writes and coherence', () => {
  it('rejects an unknown key with not_found', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'unknown.key', 'value'),
      ).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  it('rejects security.jwt_expiry as read-only (conflict)', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), SUPER_ADMIN, 'security.jwt_expiry', 1800),
      ).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  it('rejects security.cors_allowlist for an admin (insufficient_scope)', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'security.cors_allowlist', ['https://admin.example.com']),
      ).rejects.toMatchObject({ code: 'insufficient_scope' });
    });
  });

  it('rejects a non-https public_url with validation_failed details', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), SUPER_ADMIN, 'instance.public_url', 'not-a-url'),
      ).rejects.toMatchObject({ code: 'validation_failed', details: { fieldErrors: expect.any(Object) } });
    });
  });

  it('rejects an unknown or disabled default currency with currency_not_enabled', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'localization.default_currency', 'XXX'),
      ).rejects.toMatchObject({ code: 'currency_not_enabled' });

      await c.query("update public.currencies set enabled = false where code = 'EUR'");
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'localization.default_currency', 'EUR'),
      ).rejects.toMatchObject({ code: 'currency_not_enabled' });
    });
  });

  it('rejects enabled_locales without en', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'localization.enabled_locales', ['es']),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });
  });

  it('rejects provider=fcm until every FCM key is configured', async () => {
    await inRollback(async (c) => {
      await expect(
        writeSetting(settingsDeps(c), ADMIN, 'notifications.push.provider', 'fcm'),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });
  });

  it('rejects a service account whose project_id does not match fcm_project_id', async () => {
    await inRollback(async (c) => {
      const admin = await createTestUser(c, {
        email: `svc-admin-${Date.now()}@test.local`,
        role: 'admin',
      });
      const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };

      await writeSetting(settingsDeps(c), caller, 'notifications.push.fcm_project_id', 'other-project');
      await expect(
        writeSetting(settingsDeps(c), caller, 'notifications.push.fcm_service_account', SERVICE_ACCOUNT),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });
  });

  it('stores a secret encrypted only: value null, value_encrypted set, masked on read', async () => {
    await inRollback(async (c) => {
      const admin = await createTestUser(c, {
        email: `secret-admin-${Date.now()}@test.local`,
        role: 'admin',
      });
      const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };

      await writeSetting(settingsDeps(c), caller, 'notifications.push.fcm_project_id', 'demo-project');
      const view = await writeSetting(
        settingsDeps(c),
        caller,
        'notifications.push.fcm_service_account',
        SERVICE_ACCOUNT,
      );

      // The returned view never carries the plaintext, only the configured flag.
      expect(view.isSecret).toBe(true);
      expect(view.configured).toBe(true);
      expect('value' in view).toBe(false);

      const { rows } = await query(
        c,
        "select value, value_encrypted from public.settings where key = 'notifications.push.fcm_service_account'",
      );
      expect(rows[0].value).toBeNull();
      expect(String(rows[0].value_encrypted)).toMatch(/^v1:/);
      expect(String(rows[0].value_encrypted)).not.toContain('PRIVATE KEY');
    });
  });

  it('rejects a secret write when the encryption key is missing (fail closed)', async () => {
    await inRollback(async (c) => {
      const admin = await createTestUser(c, {
        email: `nokey-admin-${Date.now()}@test.local`,
        role: 'admin',
      });
      const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };

      // Configure the matching project_id so coherence passes and the only
      // rejection reason left is the missing encryption key.
      await writeSetting(settingsDeps(c), caller, 'notifications.push.fcm_project_id', 'demo-project');

      await expect(
        writeSetting(settingsDeps(c, null), caller, 'notifications.push.fcm_service_account', SERVICE_ACCOUNT),
      ).rejects.toMatchObject({ code: 'internal' });
    });
  });

  it('records the session actor on non-secret writes', async () => {
    await inRollback(async (c) => {
      const admin = await createTestUser(c, {
        email: `actor-admin-${Date.now()}@test.local`,
        role: 'admin',
      });
      const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };

      await writeSetting(settingsDeps(c), caller, 'instance.name', 'My Family');
      const { rows } = await query(
        c,
        "select updated_by, updated_by_key from public.settings where key = 'instance.name'",
      );
      expect(rows[0].updated_by).toBe(admin.id);
      expect(rows[0].updated_by_key).toBeNull();
    });
  });
});

describe('settings service — reads', () => {
  it('reads every catalog setting for a super_admin, masking secrets and exposing non-secret values', async () => {
    await inRollback(async (c) => {
      const all = await readAllSettings(settingsDeps(c), SUPER_ADMIN);
      expect(all).toHaveLength(SETTINGS_CATALOG.length);

      const byKey = new Map(all.map((s) => [s.key, s]));
      expect(byKey.get('instance.name')?.value).toBe(CATALOG_DEFAULTS['instance.name']);
      expect(byKey.get('notifications.push.fcm_service_account')?.isSecret).toBe(true);
      expect(byKey.get('notifications.push.fcm_service_account')?.configured).toBe(false);
      expect('value' in (byKey.get('notifications.push.fcm_service_account') ?? {})).toBe(false);
      for (const view of all) {
        expect('value_encrypted' in view).toBe(false);
      }
    });
  });

  it('hides superAdminOnly keys from an admin (F-G)', async () => {
    await inRollback(async (c) => {
      const all = await readAllSettings(settingsDeps(c), ADMIN);
      const keys = all.map((s) => s.key);
      expect(keys).not.toContain('security.cors_allowlist');
      expect(keys).not.toContain('security.jwt_expiry');
      expect(keys).not.toContain('instance.public_url');
      expect(keys).toContain('instance.name');
    });
  });

  it('returns only public non-secret settings for /instance (unaffected by F-G)', async () => {
    await inRollback(async (c) => {
      const pub = await readPublicSettings(settingsDeps(c));
      expect(Object.keys(pub).sort()).toEqual([
        'instance.logo_url',
        'instance.name',
        'instance.public_url',
        'localization.default_currency',
        'localization.default_locale',
        'localization.enabled_locales',
        'localization.timezone',
        'notifications.push.fcm_api_key',
        'notifications.push.fcm_app_id',
        'notifications.push.fcm_project_id',
        'notifications.push.fcm_sender_id',
      ]);
      expect(pub['security.cors_allowlist']).toBeUndefined();
      expect(pub['notifications.push.fcm_service_account']).toBeUndefined();
    });
  });
});

describe('settings service — health', () => {
  it('is ok when the database answers and no secret needs the encryption key', async () => {
    await inRollback(async (c) => {
      const health = await computeHealth(settingsDeps(c));
      expect(health).toEqual({ status: 'ok', degradedReasons: [] });
    });
  });

  it('degrades when a secret is configured but the encryption key is missing', async () => {
    await inRollback(async (c) => {
      await c.query(
        "update public.settings set value_encrypted = 'v1:aa:bb:cc' where key = 'notifications.push.fcm_service_account'",
      );
      const health = await computeHealth(settingsDeps(c, null));
      expect(health.status).toBe('degraded');
      expect(health.degradedReasons).toContain('encryption_key_missing');
    });
  });

  it('degrades when the database is unreachable', async () => {
    const deps: SettingsDeps = {
      db: {
        async query() {
          throw new Error('connection refused');
        },
      },
      encryption: createSettingsEncryption(TEST_KEY),
      currencies: { async isEnabled() { return true; } },
    };
    const health = await computeHealth(deps);
    expect(health.status).toBe('degraded');
    expect(health.degradedReasons).toContain('database_unreachable');
  });
});
