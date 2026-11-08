import { describe, expect, it } from 'vitest';
import type { Caller, DoorDeps } from '../api/types';
import type { QueryClient, RateLimitStorage } from '../api/rate-limit-storage';
import { patchCurrenciesRoute, type CurrenciesRouteDeps } from './api.js';
import type { CurrenciesDeps } from './service.js';

const admin: Caller = { kind: 'session', userId: 'admin-1', role: 'admin' };

/**
 * In-memory currencies table. `withTransaction` snapshots the map and restores
 * it when the callback throws, so the atomicity test observes real rollback
 * semantics without a database.
 */
function memoryCurrencies(initial: Record<string, boolean>, defaultCode = 'EUR') {
  const state = new Map<string, boolean>(Object.entries(initial));
  let snapshot: Map<string, boolean> | null = null;

  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith('update public.currencies')) {
        const code = String(params[0]);
        const enabled = params[1] === true;
        if (!state.has(code)) return { rows: [] };
        state.set(code, enabled);
        return { rows: [{ code, enabled }] };
      }
      if (sql.startsWith('select code, enabled')) {
        return {
          rows: [...state.entries()].map(([code, enabled]) => ({ code, enabled })),
        };
      }
      return { rows: [] };
    },
  };

  const currencies: CurrenciesDeps = {
    db,
    async withTransaction<T>(fn: (client: QueryClient) => Promise<T>): Promise<T> {
      snapshot = new Map(state);
      try {
        return await fn(db);
      } catch (err) {
        if (snapshot) {
          state.clear();
          for (const [code, enabled] of snapshot) state.set(code, enabled);
        }
        throw err;
      } finally {
        snapshot = null;
      }
    },
    async defaultCurrency() {
      return defaultCode;
    },
  };

  return { currencies, state };
}

function countingStorage(): { storage: RateLimitStorage; increments: () => number } {
  const counts = new Map<string, number>();
  let calls = 0;
  return {
    storage: {
      async increment(key) {
        calls += 1;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return { count };
      },
    },
    increments: () => calls,
  };
}

function deps(
  currencies: CurrenciesDeps,
  counter: { storage: RateLimitStorage },
  caller: Caller = admin,
): CurrenciesRouteDeps {
  const door: DoorDeps = { rateLimitStorage: counter.storage, logger: () => {} };
  return { door, auth: async () => caller, currencies };
}

function batchRequest(updates: Array<{ code: string; enabled: boolean }>): Request {
  return new Request('http://local/api/v1/currencies', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
}

describe('PATCH /api/v1/currencies (batch)', () => {
  it('applies three changes from a single request', async () => {
    const counter = countingStorage();
    const { currencies, state } = memoryCurrencies({ EUR: true, USD: true, JPY: true, SEK: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter));

    const res = await PATCH(
      batchRequest([
        { code: 'USD', enabled: false },
        { code: 'JPY', enabled: false },
        { code: 'SEK', enabled: false },
      ]),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      default: string | null;
      currencies: Array<{ code: string; enabled: boolean; isDefault: boolean }>;
    };
    expect(body.default).toBe('EUR');
    expect(
      body.currencies
        .filter((currency) => !currency.enabled)
        .map((currency) => currency.code)
        .sort(),
    ).toEqual(['JPY', 'SEK', 'USD']);
    expect(state.get('USD')).toBe(false);
    expect(state.get('JPY')).toBe(false);
    expect(state.get('SEK')).toBe(false);
  });

  it('consumes exactly one write slot per batch', async () => {
    const counter = countingStorage();
    const { currencies } = memoryCurrencies({ EUR: true, USD: true, JPY: true, SEK: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter));

    expect(counter.increments()).toBe(0);
    expect((await PATCH(batchRequest([{ code: 'USD', enabled: false }]))).status).toBe(200);
    expect(counter.increments()).toBe(1);
  });

  it('refuses to disable the default and applies nothing (atomic)', async () => {
    const counter = countingStorage();
    const { currencies, state } = memoryCurrencies({ EUR: true, USD: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter));

    const res = await PATCH(
      batchRequest([
        { code: 'USD', enabled: false },
        { code: 'EUR', enabled: false },
      ]),
    );

    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('currency_is_default');
    expect(state.get('USD')).toBe(true);
    expect(state.get('EUR')).toBe(true);
  });

  it('rolls back earlier updates when a later code does not exist', async () => {
    const counter = countingStorage();
    const { currencies, state } = memoryCurrencies({ EUR: true, USD: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter));

    const res = await PATCH(
      batchRequest([
        { code: 'USD', enabled: false },
        { code: 'AAA', enabled: false },
      ]),
    );

    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('not_found');
    expect(state.get('USD')).toBe(true);
  });

  it('rejects duplicate codes with 400 and applies nothing', async () => {
    const counter = countingStorage();
    const { currencies, state } = memoryCurrencies({ EUR: true, USD: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter));

    const res = await PATCH(
      batchRequest([
        { code: 'USD', enabled: false },
        { code: 'USD', enabled: true },
      ]),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('validation_failed');
    expect(state.get('USD')).toBe(true);
  });

  it('rejects an anonymous caller with 401', async () => {
    const counter = countingStorage();
    const { currencies } = memoryCurrencies({ EUR: true, USD: true });
    const PATCH = patchCurrenciesRoute(deps(currencies, counter, { kind: 'anon' }));

    const res = await PATCH(batchRequest([{ code: 'USD', enabled: false }]));

    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('unauthorized');
  });
});
