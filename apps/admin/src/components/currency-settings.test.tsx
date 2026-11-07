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
];

describe("CurrencySettings", () => {
  it("marks the default currency and refuses to disable it in the UI", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} messages={{}} />,
    );

    expect(html).toContain("EUR");
    expect(html).toContain("Default");
    expect(html).toContain("The default currency cannot be disabled.");
    const eur = html.match(/<input[^>]*id="currency-EUR"[^>]*>/)?.[0];
    expect(eur).toContain("disabled");
    expect(eur).toContain("checked");
  });

  it("keeps every other currency toggleable", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} messages={{}} />,
    );

    expect(html).toContain("USD");
    expect(html).toContain("JPY");
    expect(html).toContain("Enabled");
    expect(html).toContain("Disabled");
    const usd = html.match(/<input[^>]*id="currency-USD"[^>]*>/)?.[0];
    expect(usd).toBeDefined();
    expect(usd).not.toContain("disabled");
  });
});
