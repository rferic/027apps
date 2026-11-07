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

  it("sends the whole clear-all batch as one PATCH with one entry per currency", async () => {
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          default: "EUR",
          currencies: [
            { code: "EUR", enabled: true, isDefault: true },
            { code: "USD", enabled: false, isDefault: false },
            { code: "SEK", enabled: false, isDefault: false },
          ],
        }),
        { status: 200 },
      ),
    );

    const changes = bulkDisableChanges(CURRENCIES);
    const result = await applyCurrencyChanges(changes, fetcher);

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/currencies");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      updates: [
        { code: "USD", enabled: false },
        { code: "SEK", enabled: false },
      ],
    });
  });

  it("does not call the API when there is nothing to clear", async () => {
    const fetcher = vi.fn();

    await expect(applyCurrencyChanges([], fetcher)).resolves.toEqual({ ok: true });

    expect(fetcher).not.toHaveBeenCalled();
  });
});
