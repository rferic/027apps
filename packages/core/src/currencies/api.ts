/**
 * Currencies API routes (instance-config spec §6): authenticated list and
 * admin-only enable/disable with the default-currency guard.
 */

import { z } from 'zod';
import { withDoor } from '../api/door';
import { authorize } from '../auth/guard';
import type { Caller, DoorDeps } from '../api/types';
import { listCurrencies, setCurrencyEnabled, type CurrenciesDeps } from './service';

export interface CurrenciesRouteDeps {
  door: DoorDeps;
  auth: (req: Request) => Promise<Caller>;
  currencies: CurrenciesDeps;
}

const patchBodySchema = z.object({ enabled: z.boolean() }).strict();

/** GET /api/v1/currencies — enabled currencies and the default. */
export function currenciesRoute(deps: CurrenciesRouteDeps) {
  return (req: Request): Promise<Response> =>
    withDoor(req, { scopes: ['currencies:read'], auth: deps.auth }, deps.door, async (ctx) => {
      authorize(ctx.caller, ['currencies:read']);
      return listCurrencies(deps.currencies);
    });
}

/** PATCH /api/v1/currencies/{code} — enable/disable; default currency is protected. */
export function patchCurrencyRoute(deps: CurrenciesRouteDeps) {
  return (req: Request, code: string): Promise<Response> =>
    withDoor(req, { scopes: ['currencies:write'], auth: deps.auth, schema: patchBodySchema }, deps.door, async (ctx) => {
      authorize(ctx.caller, ['currencies:write']);
      const { enabled } = ctx.body as { enabled: boolean };
      const currency = await setCurrencyEnabled(deps.currencies, ctx.caller, code, enabled);
      return { currency };
    });
}
