import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { CurrencySettings } from "./currency-settings";

const CURRENCIES = [
  { code: "EUR", enabled: true, isDefault: true },
  { code: "USD", enabled: true, isDefault: false },
  { code: "JPY", enabled: false, isDefault: false },
  { code: "SEK", enabled: true, isDefault: false },
];

describe("CurrencySettings", () => {
  it("renders a search control and a fieldset with the currency list", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).toMatch(/<input[^>]*type="search"[^>]*>/);
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Search currencies");
    expect(html).toContain("aria-describedby");
  });

  it("shows symbol, localized name and code for every currency", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).toContain("€ · Euro (EUR)");
    expect(html).toContain("$ · US Dollar (USD)");
    expect(html).toContain("¥ · Japanese Yen (JPY)");
    expect(html).toContain("SEK · Swedish Krona (SEK)");
  });

  it("marks the default currency and refuses to deselect it", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    const eur = html.match(/<input[^>]*id="currency-EUR"[^>]*>/)?.[0];
    expect(eur).toContain("disabled");
    expect(eur).toContain("checked");
    expect(html).toContain("Default currency");
    expect(html).toContain(`aria-describedby="currency-EUR-default"`);
  });

  it("keeps every other currency toggleable", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    for (const code of ["USD", "JPY", "SEK"]) {
      const input = html.match(new RegExp(`<input[^>]*id="currency-${code}"[^>]*>`))?.[0];
      expect(input).toBeDefined();
      expect(input).not.toContain("disabled");
    }
    const usd = html.match(/<input[^>]*id="currency-USD"[^>]*>/)?.[0];
    expect(usd).toContain("checked");
    const jpy = html.match(/<input[^>]*id="currency-JPY"[^>]*>/)?.[0];
    expect(jpy).not.toContain("checked");
  });

  it("shows the enabled counter and the bulk action", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).toContain("3 of 4 enabled");
    expect(html).toContain("Deselect all except the default");
  });

  it("shows the search empty state instead of an empty list", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode={null} currencies={[]} locale="en" messages={{}} />,
    );

    expect(html).toContain("No currencies match");
    expect(html).toContain("No default currency is configured.");
  });
});
