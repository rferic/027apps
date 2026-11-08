/**
 * Currencies API routes (instance-config spec §6): authenticated list and
 * admin-only enable/disable with the default-currency guard.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import { DEFAULT_READ_LIMIT, DEFAULT_WRITE_LIMIT } from '../api/rate-limits';
import type { Caller, CorsOptions, DoorDeps } from '../api/types';
import { listCurrencies, setCurrenciesEnabled, setCurrencyEnabled, type CurrenciesDeps } from './service';

export interface CurrenciesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  currencies: CurrenciesDeps;
  cors?: CorsOptions;
  rateLimits?: { public?: number; read?: number; write?: number };
}

export const patchCurrencyBodySchema = z.object({ enabled: z.boolean() }).strict();

export const patchCurrenciesBodySchema = z
  .object({
    updates: z
      .array(z.object({ code: z.string(), enabled: z.boolean() }).strict())
      .min(1)
      .max(200),
  })
  .strict();

/** GET /api/v1/currencies — all currencies with their enabled flag and default. */
export function currenciesRoute(deps: CurrenciesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['currencies:read'],
        auth: deps.auth,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.read ?? DEFAULT_READ_LIMIT },
      },
      deps.door,
      async () => listCurrencies(deps.currencies),
    );
}

/** PATCH /api/v1/currencies/{code} — enable/disable; default currency is protected. */
export function patchCurrencyRoute(deps: CurrenciesRouteDeps) {
  return (req: Request, code: string): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['currencies:write'],
        auth: deps.auth,
        schema: patchCurrencyBodySchema,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        const { enabled } = ctx.body as { enabled: boolean };
        const currency = await setCurrencyEnabled(deps.currencies, ctx.caller, code, enabled);
        return { currency };
      },
    );
}

/**
 * PATCH /api/v1/currencies — body `{ updates: [{ code, enabled }] }` (1…200).
 * One transaction and one write slot for the whole batch; the default currency
 * still cannot be disabled.
 */
export function patchCurrenciesRoute(deps: CurrenciesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(
      req,
      {
        scopes: ['currencies:write'],
        auth: deps.auth,
        schema: patchCurrenciesBodySchema,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.write ?? DEFAULT_WRITE_LIMIT },
      },
      deps.door,
      async (ctx) => {
        const { updates } = ctx.body as { updates: Array<{ code: string; enabled: boolean }> };
        return setCurrenciesEnabled(deps.currencies, ctx.caller, updates);
      },
    );
}
