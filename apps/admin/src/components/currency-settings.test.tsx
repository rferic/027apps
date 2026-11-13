import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const resetOnRoute = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/panel/settings/localization",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/use-reset-on-route", () => ({
  useResetOnRouteChange: resetOnRoute,
}));

import { CurrencySettings } from "./currency-settings";

const CURRENCIES = [
  { code: "EUR", enabled: true, isDefault: true },
  { code: "USD", enabled: true, isDefault: false },
  { code: "JPY", enabled: false, isDefault: false },
  { code: "SEK", enabled: true, isDefault: false },
];

describe("CurrencySettings", () => {
  it("re-seeds its transient state from the currencies the server sent", () => {
    resetOnRoute.mockClear();

    renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    const [seed, reset] = resetOnRoute.mock.calls[0] ?? [];
    expect(seed).toBe(CURRENCIES);
    expect(typeof reset).toBe("function");
  });

  it("renders the combobox with a chip per enabled currency", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).toContain('role="combobox"');
    expect(html).toContain("€ · Euro");
    expect(html).toContain("$ · US Dollar");
    expect(html).toContain("SEK · Swedish Krona");
    expect(html).not.toContain("Japanese Yen");
  });

  it("replaces the old checkbox list", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("<fieldset");
  });

  it("keeps the default currency fixed and removable ones clearable", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings defaultCode="EUR" currencies={CURRENCIES} locale="en" messages={{}} />,
    );

    expect(html).toContain('data-fixed="true"');
    expect(html).not.toContain('data-remove="EUR"');
    expect(html).toContain('data-remove="USD"');
    expect(html).toContain('data-remove="SEK"');
  });

  it("shows the empty trigger when no currency is enabled", () => {
    const html = renderToStaticMarkup(
      <CurrencySettings
        defaultCode={null}
        currencies={[{ code: "EUR", enabled: false, isDefault: false }]}
        locale="en"
        messages={{}}
      />,
    );

    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('data-remove="');
    expect(html).toContain("No default currency is configured.");
  });
});
