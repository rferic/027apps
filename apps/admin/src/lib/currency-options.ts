import { patchCurrencies } from "@/lib/currency-mutations";
import type { MutationResult } from "@/lib/mutation-result";
import type { CurrencyRow } from "@/lib/setting-types";

/**
 * Currency metadata the database does not store: only `code`, `enabled` and
 * `isDefault` exist. Name and symbol are derived in the client from the UI
 * locale, with the code as the fallback when the runtime lacks the data.
 */
export interface CurrencyOption extends CurrencyRow {
  name: string;
  symbol: string;
}

export interface CurrencyChange {
  code: string;
  enabled: boolean;
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function currencyName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency: code }).formatToParts(
      0,
    );
    return parts.find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

export function currencyLabel(currency: CurrencyRow, locale: string): string {
  const symbol = currencySymbol(currency.code, locale);
  const name = currencyName(currency.code, locale);
  return `${symbol} · ${name} (${currency.code})`;
}

export function currencyOptions(
  currencies: readonly CurrencyRow[],
  locale: string,
): CurrencyOption[] {
  return currencies.map((currency) => ({
    ...currency,
    name: currencyName(currency.code, locale),
    symbol: currencySymbol(currency.code, locale),
  }));
}

export function filterCurrencies(
  currencies: readonly CurrencyOption[],
  query: string,
): CurrencyOption[] {
  const needle = normalizeSearch(query);
  if (!needle) return [...currencies];
  return currencies.filter((currency) => {
    return (
      normalizeSearch(currency.name).includes(needle) ||
      normalizeSearch(currency.code).includes(needle) ||
      normalizeSearch(currency.symbol).includes(needle)
    );
  });
}

export function enabledCount(currencies: readonly CurrencyRow[]): {
  enabled: number;
  total: number;
} {
  return {
    enabled: currencies.filter((currency) => currency.enabled).length,
    total: currencies.length,
  };
}

/** Every enabled non-default currency, so a bulk action never touches the default. */
export function bulkDisableChanges(currencies: readonly CurrencyRow[]): CurrencyChange[] {
  return currencies
    .filter((currency) => currency.enabled && !currency.isDefault)
    .map((currency) => ({ code: currency.code, enabled: false }));
}

/**
 * Sends every change in one PATCH so clearing the list never burns one
 * rate-limit slot per currency. Callers refresh once after the batch.
 */
export async function applyCurrencyChanges(
  changes: readonly CurrencyChange[],
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  return patchCurrencies(changes, fetcher);
}
