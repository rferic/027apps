import { describe, expect, it, vi } from "vitest";
import {
  applyCurrencyChanges,
  bulkDisableChanges,
  currencyLabel,
  currencyName,
  currencyOptions,
  currencySymbol,
  enabledCount,
  filterCurrencies,
  normalizeSearch,
} from "./currency-options";

const CURRENCIES = [
  { code: "EUR", enabled: true, isDefault: true },
  { code: "USD", enabled: true, isDefault: false },
  { code: "JPY", enabled: false, isDefault: false },
  { code: "SEK", enabled: true, isDefault: false },
];

describe("currencyName / currencySymbol", () => {
  it("derives the localized name and symbol from Intl", () => {
    expect(currencyName("EUR", "en")).toBe("Euro");
    expect(currencyName("EUR", "es")).toBe("euro");
    expect(currencyName("USD", "en")).toContain("Dollar");
    expect(currencySymbol("EUR", "en")).toBe("€");
    expect(currencySymbol("USD", "en")).toBe("$");
  });

  it("falls back to the code when Intl cannot format it", () => {
    expect(currencyName("ZZZ", "en")).toBe("ZZZ");
    expect(currencySymbol("ZZZ", "en")).toBe("ZZZ");
  });

  it("renders the label as symbol · Name (CODE)", () => {
    expect(currencyLabel({ code: "EUR", enabled: true, isDefault: true }, "en")).toBe(
      "€ · Euro (EUR)",
    );
  });
});

describe("search", () => {
  const options = currencyOptions(CURRENCIES, "en");

  it("normalizes case and diacritics", () => {
    expect(normalizeSearch("  Dólar  ")).toBe("dolar");
  });

  it("filters by name, code or symbol", () => {
    expect(filterCurrencies(options, "euro").map((option) => option.code)).toEqual(["EUR"]);
    expect(filterCurrencies(options, "jpy").map((option) => option.code)).toEqual(["JPY"]);
    expect(filterCurrencies(options, "$").map((option) => option.code)).toEqual(["USD"]);
    expect(filterCurrencies(options, "swedish").map((option) => option.code)).toEqual(["SEK"]);
    expect(filterCurrencies(options, "nothing")).toEqual([]);
  });

  it("keeps every row for an empty query", () => {
    expect(filterCurrencies(options, "  ")).toHaveLength(CURRENCIES.length);
  });
});

describe("selection", () => {
  it("counts the enabled currencies without counting the default twice", () => {
    expect(enabledCount(CURRENCIES)).toEqual({ enabled: 3, total: 4 });
  });

  it("deselect all only targets enabled non-default currencies", () => {
    expect(bulkDisableChanges(CURRENCIES)).toEqual([
      { code: "USD", enabled: false },
      { code: "SEK", enabled: false },
    ]);
  });

  it("sends one PATCH per toggle with the new flag", async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ currency: { code: "USD", enabled: true } }), { status: 200 }),
    );

    const results = await applyCurrencyChanges([{ code: "USD", enabled: true }], fetcher);

    expect(results).toEqual([{ code: "USD", result: { ok: true } }]);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/currencies/USD");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true });
  });
});
