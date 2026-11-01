import { describe, expect, it } from 'vitest';
import type { ClientBase } from 'pg';
import { withClient, query, createTestUser } from '../pg.js';
import { createSettingsEncryption } from '@027apps/core/crypto.js';
import { instanceRoute, healthRoute, type InstanceRouteDeps } from '@027apps/core/instance/api.js';
import type { SettingsDeps } from '@027apps/core/settings/service.js';

/**
 * Public door integration for /instance and /health (task-04):
 * /instance exposes only public settings plus the derived setup state;
 * /health answers 200 ok or 503 degraded with a 30 s cache. Every test runs
 * inside a transaction that rolls back.
 */

const TEST_KEY = Buffer.alloc(32, 7).toString('base64'); // exactly 32 bytes

function settingsDeps(c: ClientBase, encryption: SettingsDeps['encryption'] = createSettingsEncryption(TEST_KEY)): SettingsDeps {
  return {
    db: { async query(sql: string, params: unknown[] = []) { return query(c, sql, params); } },
    encryption,
    currencies: {
      async isEnabled(code: string) {
        const { rows } = await query(c, 'select enabled from public.currencies where code = $1', [code]);
        return rows[0]?.enabled === true;
      },
    },
  };
}

function deps(c: ClientBase, settings: SettingsDeps): InstanceRouteDeps {
  return {
    door: {
      rateLimitStorage: {
        async increment() {
          return { count: 1 };
        },
      },
      logger: () => {},
    },
    // Both doors are public: the door requires an auth function, which resolves anon.
    auth: async () => ({ kind: 'anon' }),
    settings,
    version: '0.0.1-test',
  };
}

describe('GET /api/v1/instance', () => {
  it('exposes version, derived setup state and public settings only', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const GET = instanceRoute(deps(c, settingsDeps(c)));
        const res = await GET(new Request('http://local/api/v1/instance'));
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          version: string;
          requires_setup: boolean;
          setup_incomplete: boolean;
          settings_public: Record<string, unknown>;
        };

        expect(body.version).toBe('0.0.1-test');
        // No active super_admin exists in this transaction: the wizard is pending.
        expect(body.requires_setup).toBe(true);
        expect(body.setup_incomplete).toBe(false);
        expect(body.settings_public).not.toHaveProperty('security.cors_allowlist');
        expect(body.settings_public).not.toHaveProperty('rate_limit.mobile_per_min');
        expect(body.settings_public).not.toHaveProperty('notifications.push.fcm_service_account');
        expect(body.settings_public['instance.name']).toBe('027Apps');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('flips requires_setup and setup_incomplete once an admin exists without public_url', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const admin = await createTestUser(c, { email: `inst-admin-${Date.now()}@test.local`, role: 'super_admin' });
        const GET = instanceRoute(deps(c, settingsDeps(c)));
        const res = await GET(new Request('http://local/api/v1/instance'));
        const body = (await res.json()) as { requires_setup: boolean; setup_incomplete: boolean };
        expect(body.requires_setup).toBe(false);
        expect(body.setup_incomplete).toBe(true);

        // Configuring the public URL completes the wizard.
        await query(c, "update public.settings set value = '\"https://example.com\"' where key = 'instance.public_url'");
        const res2 = await GET(new Request('http://local/api/v1/instance'));
        const body2 = (await res2.json()) as { setup_incomplete: boolean };
        expect(body2.setup_incomplete).toBe(false);
        void admin;
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});

describe('GET /api/v1/health', () => {
  it('answers ok with a 30s cache header', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const GET = healthRoute(deps(c, settingsDeps(c)));
        const res = await GET(new Request('http://local/api/v1/health'));
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('public, max-age=30');
        const body = (await res.json()) as { status: string; degradedReasons?: string[] };
        expect(body.status).toBe('ok');
        expect(body.degradedReasons).toBeUndefined();
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('degrades when a secret is configured but the encryption key is missing', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        await query(
          c,
          "update public.settings set value_encrypted = 'v1:aaa:bbb:ccc' where key = 'notifications.push.fcm_service_account'",
        );
        const GET = healthRoute(deps(c, settingsDeps(c, null)));
        const res = await GET(new Request('http://local/api/v1/health'));
        expect(res.status).toBe(503);
        const body = (await res.json()) as { status: string; degradedReasons: string[] };
        expect(body.status).toBe('degraded');
        expect(body.degradedReasons).toContain('encryption_key_missing');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('degrades when the database is unreachable', async () => {
    const broken: SettingsDeps = {
      db: {
        async query() {
          throw new Error('connection refused');
        },
      },
      encryption: null,
      currencies: { async isEnabled() { return true; } },
    };
    const GET = healthRoute(deps(await withClient(async () => null as unknown as ClientBase), broken));
    const res = await GET(new Request('http://local/api/v1/health'));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { status: string; degradedReasons: string[] };
    expect(body.degradedReasons).toContain('database_unreachable');
  });
});
