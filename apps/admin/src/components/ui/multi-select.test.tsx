import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  clearableValues,
  filterMultiSelectOptions,
  MultiSelect,
  type MultiSelectOption,
} from "./multi-select";

const OPTIONS: MultiSelectOption[] = [
  { value: "EUR", label: "€ · Euro", hint: "EUR", fixed: true },
  { value: "USD", label: "$ · US Dollar", hint: "USD" },
  { value: "JPY", label: "¥ · Japanese Yen", hint: "JPY" },
  { value: "SEK", label: "SEK · Swedish Krona", hint: "SEK" },
];

function render(
  values: string[],
  extra: Partial<Parameters<typeof MultiSelect>[0]> = {},
): string {
  return renderToStaticMarkup(
    <MultiSelect
      label="Currencies"
      placeholder="Currencies"
      searchPlaceholder="Search by name, code or symbol."
      options={OPTIONS}
      values={values}
      onToggle={() => undefined}
      onClear={() => undefined}
      emptyLabel="No currencies match"
      messages={{}}
      {...extra}
    />,
  );
}

describe("MultiSelect", () => {
  it("shows the placeholder and no chips when nothing is selected", () => {
    const html = render([]);

    expect(html).toContain("Currencies");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-remove="');
  });

  it("renders a chip per selected value and lets every non-fixed one be removed", () => {
    const html = render(["EUR", "USD"]);

    expect(html).toContain("€ · Euro");
    expect(html).toContain("$ · US Dollar");
    expect(html).toContain('data-remove="USD"');
  });

  it("never renders a remove button for the fixed default", () => {
    const html = render(["EUR", "USD"]);

    expect(html).toContain('data-fixed="true"');
    expect(html).not.toContain('data-remove="EUR"');
  });

  it("marks selected options with aria-selected in the listbox", () => {
    const html = render(["EUR"], { initialOpen: true });

    const eur = html.match(/<li[^>]*data-value="EUR"[^>]*>/)?.[0];
    const usd = html.match(/<li[^>]*data-value="USD"[^>]*>/)?.[0];
    expect(html).toContain('role="listbox"');
    expect(html).toContain('aria-multiselectable="true"');
    expect(eur).toContain('aria-selected="true"');
    expect(usd).toContain('aria-selected="false"');
  });

  it("shows the selected counter", () => {
    const html = render(["EUR", "USD"], { initialOpen: true });

    expect(html).toContain("2 of 4 selected");
  });

  it("marks the pending option as busy without hiding it", () => {
    const html = render(["EUR"], { initialOpen: true, pendingValue: "USD" });

    const usd = html.match(/<li[^>]*data-value="USD"[^>]*>/)?.[0];
    expect(usd).toContain("opacity-60");
  });
});

describe("filterMultiSelectOptions", () => {
  it("filters by name, code and symbol, ignoring case and accents", () => {
    expect(filterMultiSelectOptions(OPTIONS, "dollar").map((item) => item.value)).toEqual(["USD"]);
    expect(filterMultiSelectOptions(OPTIONS, "jpy").map((item) => item.value)).toEqual(["JPY"]);
    expect(filterMultiSelectOptions(OPTIONS, "€").map((item) => item.value)).toEqual(["EUR"]);
    expect(filterMultiSelectOptions(OPTIONS, "sueco").map((item) => item.value)).toEqual([]);
  });

  it("keeps every option for an empty query", () => {
    expect(filterMultiSelectOptions(OPTIONS, "  ")).toHaveLength(OPTIONS.length);
  });
});

describe("clearableValues", () => {
  it("excludes the fixed default so the bulk action never disables it", () => {
    expect(clearableValues(OPTIONS, ["EUR", "USD", "JPY"])).toEqual(["USD", "JPY"]);
  });
});
