/**
 * Currencies API routes (instance-config spec §6): authenticated list and
 * admin-only enable/disable with the default-currency guard.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import type { Caller, CorsOptions, DoorDeps } from '../api/types';
import { listCurrencies, setCurrencyEnabled, type CurrenciesDeps } from './service';

export interface CurrenciesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  currencies: CurrenciesDeps;
  cors?: CorsOptions;
  rateLimits?: { public?: number; write?: number };
}

const patchBodySchema = z.object({ enabled: z.boolean() }).strict();

/** GET /api/v1/currencies — all currencies with their enabled flag and default. */
export function currenciesRoute(deps: CurrenciesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, { scopes: ['currencies:read'], auth: deps.auth, cors: deps.cors }, deps.door, async () =>
      listCurrencies(deps.currencies),
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
        schema: patchBodySchema,
        cors: deps.cors,
        rateLimit: { identity: 'user', limit: deps.rateLimits?.write ?? 10 },
      },
      deps.door,
      async (ctx) => {
        const { enabled } = ctx.body as { enabled: boolean };
        const currency = await setCurrencyEnabled(deps.currencies, ctx.caller, code, enabled);
        return { currency };
      },
    );
}
