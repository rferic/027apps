import { describe, expect, it } from 'vitest';
import type { ClientBase } from 'pg';
import { withClient, query, createTestUser } from '../pg.js';
import { currenciesRoute, patchCurrencyRoute, type CurrenciesRouteDeps } from '@027apps/core/currencies/api.js';
import type { Caller } from '@027apps/core/api/types.js';
import type { RateLimitStorage } from '@027apps/core/api/rate-limit-storage.js';

/**
 * Door integration for the currencies API (task-04): GET list (authenticated)
 * and PATCH enable/disable (admin). The default currency cannot be disabled.
 * Every test runs inside a transaction that always rolls back.
 */

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

function currenciesDeps(c: ClientBase, caller: Caller): CurrenciesRouteDeps {
  return {
    door: { rateLimitStorage: memoryRateLimitStorage(), logger: () => {} },
    auth: async () => caller,
    currencies: {
      db: { async query(sql: string, params?: unknown[]) { return query(c, sql, params); } },
      defaultCurrency: async () => {
        const { rows } = await query(
          c,
          "select value from public.settings where key = 'localization.default_currency'",
        );
        return rows[0] ? (rows[0].value as string) : null; // jsonb is already parsed
      },
    },
  };
}

describe('GET /api/v1/currencies', () => {
  it('rejects anon with 401', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const GET = currenciesRoute(currenciesDeps(c, { kind: 'anon' }));
        const res = await GET(new Request('http://local/api/v1/currencies'));
        expect(res.status).toBe(401);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unauthorized');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('lists enabled currencies for any authenticated caller', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const user = await createTestUser(c, { email: `cur-user-${Date.now()}@test.local`, role: 'user' });
        const GET = currenciesRoute(currenciesDeps(c, { kind: 'session', userId: user.id, role: 'user' }));
        const res = await GET(new Request('http://local/api/v1/currencies'));
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
          default: string;
          currencies: { code: string; enabled: boolean; isDefault: boolean }[];
        };
        expect(body.default).toBe('EUR');
        expect(body.currencies.length).toBeGreaterThan(100);
        expect(body.currencies.every((cur) => cur.enabled)).toBe(true);
        expect(body.currencies.find((cur) => cur.code === 'EUR')?.isDefault).toBe(true);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});

describe('PATCH /api/v1/currencies/{code}', () => {
  it('disables and re-enables a non-default currency as admin', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const admin = await createTestUser(c, { email: `cur-admin-${Date.now()}@test.local`, role: 'admin' });
        const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };
        const PATCH = patchCurrencyRoute(currenciesDeps(c, caller));

        const res = await PATCH(
          new Request('http://local/api/v1/currencies/USD', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          }),
          'USD',
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { currency: { code: string; enabled: boolean } };
        expect(body.currency.code).toBe('USD');
        expect(body.currency.enabled).toBe(false);

        const res2 = await PATCH(
          new Request('http://local/api/v1/currencies/USD', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: true }),
          }),
          'USD',
        );
        expect(res2.status).toBe(200);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('refuses to disable the default currency (currency_not_enabled)', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const admin = await createTestUser(c, { email: `cur-admin-${Date.now()}@test.local`, role: 'admin' });
        const caller: Caller = { kind: 'session', userId: admin.id, role: 'admin' };
        const PATCH = patchCurrencyRoute(currenciesDeps(c, caller));

        const res = await PATCH(
          new Request('http://local/api/v1/currencies/EUR', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          }),
          'EUR',
        );
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('currency_not_enabled');
        const { rows } = await query(c, "select enabled from public.currencies where code = 'EUR'");
        expect(rows[0].enabled).toBe(true);
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });

  it('rejects a plain user with 403 and an unknown code with 404', async () => {
    await withClient(async (c) => {
      await c.query('BEGIN');
      try {
        const user = await createTestUser(c, { email: `cur-user-${Date.now()}@test.local`, role: 'user' });
        const userCaller: Caller = { kind: 'session', userId: user.id, role: 'user' };
        const PATCH = patchCurrencyRoute(currenciesDeps(c, userCaller));
        const denied = await PATCH(
          new Request('http://local/api/v1/currencies/USD', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          }),
          'USD',
        );
        expect(denied.status).toBe(403);
        expect(((await denied.json()) as { error: { code: string } }).error.code).toBe('insufficient_scope');

        const admin = await createTestUser(c, { email: `cur-admin-${Date.now()}@test.local`, role: 'admin' });
        const PATCH2 = patchCurrencyRoute(currenciesDeps(c, { kind: 'session', userId: admin.id, role: 'admin' }));
        const missing = await PATCH2(
          new Request('http://local/api/v1/currencies/ZZZ', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled: false }),
          }),
          'ZZZ',
        );
        expect(missing.status).toBe(404);
        expect(((await missing.json()) as { error: { code: string } }).error.code).toBe('not_found');
      } finally {
        await c.query('ROLLBACK');
      }
    });
  });
});
