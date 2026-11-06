import { describe, expect, it } from 'vitest';
import type { ClientBase } from 'pg';
import { withClient, query, createTestUser } from '../pg.js';
import { createSettingsEncryption } from '@027apps/core/crypto.js';
import {
  settingsRoute,
  settingsCategoriesRoute,
  patchSettingRoute,
  patchSettingsRoute,
  type SettingsRouteDeps,
} from '@027apps/core/settings/api.js';
import type { DoorDeps, Caller } from '@027apps/core/api/types.js';
import type { RateLimitStorage } from '@027apps/core/api/rate-limit-storage.js';
import { SETTINGS_CATALOG } from '@027apps/core/settings/catalog.js';

/**
 * Door integration for the settings API (task-04): full GET/PATCH flows with
 * fabricated requests against the local stack. Auth is injected (the real
 * resolver is covered by auth/caller.test.ts), the database is real, and every
 * test runs inside a transaction that always rolls back.
 */

const TEST_KEY = Buffer.from('k'.repeat(32)).toString('base64');

function memoryRateLimitStorage(): RateLimitStorage {
  const counts = new Map<string, number>();
  return {
    async increment(key, windowStart, expiresAt) {
      void windowStart;
      void expiresAt;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { count };
    },
  };
}

function doorDeps(): DoorDeps {
  return { rateLimitStorage: memoryRateLimitStorage(), logger: () => {} };
}

function settingsDeps(c: ClientBase): SettingsRouteDeps['settings'] {
  return {
    db: { async query(sql: string, params?: unknown[]) { return query(c, sql, params); } },
    encryption: createSettingsEncryption(TEST_KEY),
    currencies: {
      async isEnabled(code: string) {
        const { rows } = await query(c, 'select enabled from public.currencies where code = $1', [code]);
        return rows[0]?.enabled === true;
      },
    },
  };
}

/** Factory for the route handler with an injected caller. */
function routeDeps(c: ClientBase, caller: Caller): SettingsRouteDeps {
  return { door: doorDeps(), auth: async () => caller, settings: settingsDeps(c) };
}

async function adminCaller(c: ClientBase, role: 'admin' | 'super_admin' = 'admin'): Promise<Caller> {
  const user = await createTestUser(c, { email: `api-admin-${Date.now()}@test.local`, role });
  return { kind: 'session', userId: user.id, role };
}

async function getSettings(c: ClientBase, caller: Caller): Promise<Response> {
  const GET = settingsRoute(routeDeps(c, caller));
  return GET(new Request('http://local/api/v1/settings'));
}

async function getCategories(c: ClientBase, caller: Caller): Promise<Response> {
  const GET = settingsCategoriesRoute(routeDeps(c, caller));
  return GET(new Request('http://local/api/v1/settings-categories'));
}

async function patchSetting(c: ClientBase, caller: Caller, key: string, body: unknown): Promise<Response> {
  const PATCH = patchSettingRoute(routeDeps(c, caller));
  return PATCH(
    new Request(`http://local/api/v1/settings/${key}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    key,
  );
}

async function patchSettings(c: ClientBase, caller: Caller, updates: Array<{ key: string; value: unknown }>): Promise<Response> {
  const PATCH = patchSettingsRoute(routeDeps(c, caller));
  return PATCH(
    new Request('http://local/api/v1/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ updates }),
    }),
  );
}

describe('GET /api/v1/settings', () => {
  it('rejects anon with 401 and the error envelope', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const res = await getSettings(c, { kind: 'anon' });
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: { code: string; request_id: string } };
        expect(body.error.code).toBe('unauthorized');
        expect(body.error.request_id).toEqual(expect.any(String));
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects a plain user with 403 insufficient_scope', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const user = await createTestUser(c, { email: `api-user-${Date.now()}@test.local`, role: 'user' });
        const res = await getSettings(c, { kind: 'session', userId: user.id, role: 'user' });
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('insufficient_scope');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('returns all catalog settings with secrets masked for a super_admin', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c, 'super_admin');
        await c.query("update public.settings set value_encrypted = null where key = 'notifications.push.fcm_service_account'");
        const res = await getSettings(c, caller);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { settings: { key: string; isSecret: boolean; configured?: boolean; value?: unknown; value_encrypted?: unknown }[] };

        expect(body.settings).toHaveLength(SETTINGS_CATALOG.length);
        const secret = body.settings.find((s) => s.key === 'notifications.push.fcm_service_account');
        expect(secret?.isSecret).toBe(true);
        expect(secret?.configured).toBe(false);
        expect(secret && 'value' in secret).toBe(false);

        // The serialized payload never carries encrypted values in any form.
        const text = JSON.stringify(body);
        expect(text).not.toContain('value_encrypted');
        const nonSecret = body.settings.find((s) => s.key === 'instance.name');
        expect(nonSecret?.value).toBe('027Apps');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('hides superAdminOnly keys from an admin (F-G)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c, 'admin');
        const res = await getSettings(c, caller);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { settings: { key: string }[] };
        const keys = body.settings.map((s) => s.key);
        expect(keys).not.toContain('security.cors_allowlist');
        expect(keys).not.toContain('security.jwt_expiry');
        expect(keys).not.toContain('instance.public_url');
        expect(keys).toContain('instance.name');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});

describe('GET /api/v1/settings-categories', () => {
  it('returns the 5 categories in sort order with their settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c, 'super_admin');
        const res = await getCategories(c, caller);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { categories: { categoryKey: string; sortOrder: number; settings: { key: string }[] }[] };

        expect(body.categories.map((cat) => cat.categoryKey)).toEqual([
          'instance',
          'localization',
          'security',
          'notifications',
          'rate_limit',
        ]);
        const totalSettings = body.categories.reduce((sum, cat) => sum + cat.settings.length, 0);
        expect(totalSettings).toBe(SETTINGS_CATALOG.length);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});

describe('PATCH /api/v1/settings/{key}', () => {
  it('updates a non-secret value and records the session actor', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const res = await patchSetting(c, caller, 'instance.name', { value: 'Mi instancia' });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { setting: { key: string; value: unknown } };
        expect(body.setting.key).toBe('instance.name');
        expect(body.setting.value).toBe('Mi instancia');

        const { rows } = await query(c, "select updated_by from public.settings where key = 'instance.name'");
        expect(rows[0].updated_by).toBe(caller.kind === 'session' ? caller.userId : null);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects a strict body with extra fields (validation_failed)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const res = await patchSetting(c, caller, 'instance.name', { value: 'x', extra: 1 });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('validation_failed');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects security.cors_allowlist for an admin and accepts it for super_admin', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const admin = await adminCaller(c, 'admin');
        const denied = await patchSetting(c, admin, 'security.cors_allowlist', { value: ['https://ok.example.com'] });
        expect(denied.status).toBe(403);
        expect(((await denied.json()) as { error: { code: string } }).error.code).toBe('insufficient_scope');

        const superAdmin = await adminCaller(c, 'super_admin');
        const allowed = await patchSetting(c, superAdmin, 'security.cors_allowlist', { value: ['https://ok.example.com'] });
        expect(allowed.status).toBe(200);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('returns not_found for a key outside the catalog', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const res = await patchSetting(c, caller, 'module.missing', { value: 'x' });
        expect(res.status).toBe(404);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('enforces currency coherence for the default currency', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const res = await patchSetting(c, caller, 'localization.default_currency', { value: 'XXX' });
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('currency_not_enabled');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('returns 429 after exhausting the write rate limit', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const deps: SettingsRouteDeps = {
          door: { rateLimitStorage: memoryRateLimitStorage(), logger: () => {} },
          auth: async () => caller,
          settings: settingsDeps(c),
          rateLimits: { write: 2 },
        };
        const PATCH = patchSettingRoute(deps);
        const request = () =>
          new Request('http://local/api/v1/settings/instance.name', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ value: 'limited' }),
          });

        expect((await PATCH(request(), 'instance.name')).status).toBe(200);
        expect((await PATCH(request(), 'instance.name')).status).toBe(200);
        const third = await PATCH(request(), 'instance.name');
        expect(third.status).toBe(429);
        expect(((await third.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
        expect(third.headers.get('retry-after')).not.toBeNull();
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('returns 429 after exhausting the read rate limit on GET /settings', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c);
        const deps: SettingsRouteDeps = {
          door: { rateLimitStorage: memoryRateLimitStorage(), logger: () => {} },
          auth: async () => caller,
          settings: settingsDeps(c),
          rateLimits: { read: 2 },
        };
        const GET = settingsRoute(deps);
        const request = () => new Request('http://local/api/v1/settings');

        expect((await GET(request())).status).toBe(200);
        expect((await GET(request())).status).toBe(200);
        const third = await GET(request());
        expect(third.status).toBe(429);
        expect(((await third.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
        expect(third.headers.get('retry-after')).not.toBeNull();
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});

describe('PATCH /api/v1/settings (batch)', () => {
  it('applies all 12 settings in a single request (wizard regression)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c, 'super_admin');

        const updates = [
          { key: 'localization.enabled_locales', value: ['en'] },
          { key: 'instance.name', value: '027Apps' },
          { key: 'instance.public_url', value: 'https://panel.example.com' },
          { key: 'localization.default_locale', value: 'en' },
          { key: 'localization.timezone', value: 'Europe/Madrid' },
          { key: 'localization.default_currency', value: 'EUR' },
          { key: 'notifications.push.fcm_project_id', value: 'my-project' },
          { key: 'notifications.push.fcm_app_id', value: '1:123:web:abc' },
          { key: 'notifications.push.fcm_api_key', value: 'AIzaSy...' },
          { key: 'notifications.push.fcm_sender_id', value: '123' },
          { key: 'notifications.push.fcm_service_account', value: JSON.stringify({ type: 'service_account', project_id: 'my-project', private_key: '-----BEGIN PRIVATE KEY-----', client_email: 'x@y.iam.gserviceaccount.com', token_uri: 'https://oauth2.googleapis.com/token', client_id: '123' }) },
          { key: 'notifications.push.provider', value: 'fcm' },
        ];

        const res = await patchSettings(c, caller, updates);
        expect(res.status).toBe(200);

        const body = (await res.json()) as { settings: { key: string; value?: unknown; configured?: boolean }[] };
        expect(body.settings).toHaveLength(12);

        for (const { key } of updates) {
          const setting = body.settings.find((s) => s.key === key);
          if (key === 'notifications.push.fcm_service_account') {
            expect(setting?.configured).toBe(true);
          } else {
            expect(setting?.value).not.toBeUndefined();
          }
        }

        const { rows } = await query(
          c,
          'select key, value, value_encrypted from public.settings where key = any($1)',
          [updates.map((update) => update.key)],
        );
        const stored = new Map(rows.map((row) => [row.key, row]));
        for (const { key, value } of updates) {
          const row = stored.get(key);
          if (key === 'notifications.push.fcm_service_account') {
            expect(row?.value_encrypted).toEqual(expect.any(String));
          } else {
            expect(row?.value).toEqual(value);
          }
        }
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects an invalid batch with 400, details.key and none applied', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const caller = await adminCaller(c, 'super_admin');

        const res = await patchSettings(c, caller, [
          { key: 'instance.name', value: 'changed' },
          { key: 'localization.timezone', value: 'not-a-timezone' },
        ]);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string; details?: { key?: string } } };
        expect(body.error.code).toBe('validation_failed');
        expect(body.error.details?.key).toBe('localization.timezone');

        const { rows } = await query(c, "select value from public.settings where key = 'instance.name'");
        expect(rows[0].value).toBe('027Apps');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects without session with 401', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const deps: SettingsRouteDeps = {
          door: { rateLimitStorage: memoryRateLimitStorage(), logger: () => {} },
          auth: async () => ({ kind: 'anon' }),
          settings: settingsDeps(c),
        };
        const PATCH = patchSettingsRoute(deps);
        const res = await PATCH(new Request('http://local/api/v1/settings', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ updates: [{ key: 'instance.name', value: 'x' }] }),
        }));
        expect(res.status).toBe(401);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});
