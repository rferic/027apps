/**
 * Currencies service (instance-config spec §6): the seed is the full ISO 4217
 * list enabled; admins toggle `enabled` and the default currency can never be
 * disabled.
 */

import { DomainError } from '../errors';
import type { Caller } from '../api/types';
import type { QueryClient } from '../api/rate-limit-storage';

/** Runs a unit of work on a single transactional client. */
export type TransactionRunner = <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;

export interface CurrenciesDeps {
  db: QueryClient;
  /** Optional: when present, the default check and update run on one transaction. */
  withTransaction?: TransactionRunner;
  /** Current default currency (setting `localization.default_currency`). */
  defaultCurrency(client?: QueryClient): Promise<string | null>;
}

export type CurrencyView = {
  code: string;
  enabled: boolean;
  isDefault: boolean;
};

/** GET /api/v1/currencies — all currencies with their enabled flag and default marker. */
export async function listCurrencies(deps: CurrenciesDeps): Promise<{
  default: string | null;
  currencies: CurrencyView[];
}> {
  const [defaultCurrency, rows] = await Promise.all([
    deps.defaultCurrency(),
    deps.db.query('select code, enabled from public.currencies order by code'),
  ]);
  const currencies = rows.rows.map((row) => ({
    code: String(row.code),
    enabled: row.enabled === true,
    isDefault: String(row.code) === defaultCurrency,
  }));
  return { default: defaultCurrency, currencies };
}

/** PATCH /api/v1/currencies/{code} — enable/disable; the default never disables. */
export async function setCurrencyEnabled(
  deps: CurrenciesDeps,
  caller: Caller,
  code: string,
  enabled: boolean,
): Promise<CurrencyView> {
  void caller;
  if (!/^[A-Z]{3}$/.test(code)) throw new DomainError('not_found');

  // The "is this the default?" read and the update must share one transaction;
  // otherwise a concurrent default switch can slip between them.
  const run = deps.withTransaction ?? (<T>(fn: (db: QueryClient) => Promise<T>) => fn(deps.db));

  return run(async (db) => {
    if (!enabled) {
      const current = await deps.defaultCurrency(db);
      if (current === code) throw new DomainError('currency_is_default');
    }

    const result = await db.query(
      'update public.currencies set enabled = $2, updated_at = now() where code = $1 returning code, enabled',
      [code, enabled],
    );
    if (result.rows.length === 0) throw new DomainError('not_found');
    const row = result.rows[0]!;
    return {
      code: String(row.code),
      enabled: row.enabled === true,
      isDefault: String(row.code) === (await deps.defaultCurrency(db)),
    };
  });
}
