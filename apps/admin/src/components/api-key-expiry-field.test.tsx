import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApiKeyExpiryField } from "./api-key-expiry-field";
import type { ExpiryChoice } from "@/lib/api-key-expiry";

function field(
  value: ExpiryChoice,
  options: {
    currentExpiresAt?: string | null;
    currentLabel?: string;
    fieldErrors?: Record<string, string[]>;
  } = {},
) {
  return renderToStaticMarkup(
    <ApiKeyExpiryField
      currentExpiresAt={options.currentExpiresAt ?? null}
      currentLabel={options.currentLabel ?? ""}
      value={value}
      onChange={() => {}}
      fieldErrors={options.fieldErrors ?? {}}
      messages={{}}
    />,
  );
}

function inputMarkup(html: string, id: string): string {
  const match = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(html);
  if (!match) throw new Error(`no input "${id}"`);
  return match[0];
}

describe("ApiKeyExpiryField", () => {
  it("offers never, keep and relative as a radio group", () => {
    const html = field({ mode: "keep" }, { currentExpiresAt: "2027-01-01T00:00:00.000Z" });

    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Expiry");
    expect(html).toContain('name="expiry_mode"');
    expect(html).toContain('value="never"');
    expect(html).toContain("Never expires");
    expect(html).toContain('value="keep"');
    expect(html).toContain("Keep current expiry");
    expect(html).toContain('value="relative"');
    expect(html).toContain("Expires in");
  });

  it("does not offer keep to a key that never expires and preselects never", () => {
    const html = field({ mode: "never" });

    expect(html).not.toContain('value="keep"');
    expect(html).not.toContain("Keep current expiry");
    expect(html).toContain('checked="" value="never"');
  });

  it("preselects keep and shows the current date when the key expires", () => {
    const html = field(
      { mode: "keep" },
      { currentExpiresAt: "2027-01-01T00:00:00.000Z", currentLabel: "Jan 1, 2027" },
    );

    expect(html).toContain('checked="" value="keep"');
    expect(html).toContain("Currently expires on Jan 1, 2027");
  });

  it("disables the amount and unit unless the relative mode is selected", () => {
    const never = field({ mode: "never" });
    const relative = field({ mode: "relative", amount: 30, unit: "days" });

    expect(inputMarkup(never, "api-key-expiry-amount")).toMatch(/\sdisabled(?:="")?[\s/>]/);
    expect(never).toMatch(/<select[^>]*id="api-key-expiry-unit"[^>]*\sdisabled(?:="")?[\s/>]/);
    expect(inputMarkup(relative, "api-key-expiry-amount")).not.toMatch(
      /\sdisabled(?:="")?[\s/>]/,
    );
    expect(relative).not.toMatch(/<select[^>]*id="api-key-expiry-unit"[^>]*\sdisabled(?:="")?[\s/>]/);
  });

  it("marks the amount as required only in the relative mode", () => {
    const relative = field({ mode: "relative", amount: 30, unit: "days" });
    const never = field({ mode: "never" });

    expect(inputMarkup(relative, "api-key-expiry-amount")).toContain("required");
    expect(inputMarkup(never, "api-key-expiry-amount")).not.toContain("required");
  });

  it("renders a numeric amount bounded to 1..10000 and every unit", () => {
    const html = field({ mode: "relative", amount: 7, unit: "months" });

    const amount = inputMarkup(html, "api-key-expiry-amount");
    expect(amount).toContain('name="expiry_amount"');
    expect(amount).toContain('type="number"');
    expect(amount).toContain('min="1"');
    expect(amount).toContain('step="1"');
    expect(amount).toContain('max="10000"');
    expect(amount).toContain('inputMode="numeric"');
    expect(amount).toContain('value="7"');
    expect(html).toContain('name="expiry_unit"');
    expect(html).toContain("Hours");
    expect(html).toContain("Days");
    expect(html).toContain("Months");
    expect(html).toContain("Years");
    expect(html).toContain('<option value="months" selected=""');
  });

  it("shows the amount error accessibly", () => {
    const html = field(
      { mode: "relative", amount: 0, unit: "days" },
      { fieldErrors: { expiry_amount: ["Enter a whole number between 1 and 10000."] } },
    );

    const amount = inputMarkup(html, "api-key-expiry-amount");
    expect(amount).toContain('aria-invalid="true"');
    expect(amount).toContain('aria-describedby="api-key-expiry-amount-error"');
    expect(html).toContain('id="api-key-expiry-amount-error"');
    expect(html).toContain("Enter a whole number between 1 and 10000.");
  });
});
