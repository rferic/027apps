import { describe, expect, it } from "vitest";
import {
  EXPIRY_UNITS,
  MAX_EXPIRY_AMOUNT,
  expiresAtFrom,
  parseExpiryFormData,
  type ExpiryChoice,
  type ExpiryUnit,
} from "./api-key-expiry";

const NOW = new Date("2026-01-15T10:00:00.000Z");

function relative(amount: number, unit: ExpiryUnit): ExpiryChoice {
  return { mode: "relative", amount, unit };
}

describe("EXPIRY_UNITS", () => {
  it("lists the units in display order", () => {
    expect(EXPIRY_UNITS).toEqual(["hours", "days", "months", "years"]);
  });

  it("caps an amount at 10000", () => {
    expect(MAX_EXPIRY_AMOUNT).toBe(10_000);
  });
});

describe("expiresAtFrom", () => {
  it("returns null for a key that never expires", () => {
    expect(expiresAtFrom({ mode: "never" }, NOW)).toBeNull();
  });

  it("returns undefined for a key that keeps its expiry", () => {
    expect(expiresAtFrom({ mode: "keep" }, NOW)).toBeUndefined();
  });

  it("adds hours in UTC", () => {
    expect(expiresAtFrom(relative(2, "hours"), NOW)).toBe("2026-01-15T12:00:00.000Z");
  });

  it("adds days in UTC", () => {
    expect(expiresAtFrom(relative(3, "days"), NOW)).toBe("2026-01-18T10:00:00.000Z");
  });

  it("adds months with the UTC calendar", () => {
    expect(expiresAtFrom(relative(2, "months"), NOW)).toBe("2026-03-15T10:00:00.000Z");
  });

  it("adds years with the UTC calendar", () => {
    expect(expiresAtFrom(relative(1, "years"), NOW)).toBe("2027-01-15T10:00:00.000Z");
  });

  it("accepts the smallest and largest amounts", () => {
    expect(expiresAtFrom(relative(1, "hours"), NOW)).toBe("2026-01-15T11:00:00.000Z");
    expect(expiresAtFrom(relative(MAX_EXPIRY_AMOUNT, "days"), NOW)).toMatch(
      /^\d{4}-\d{2}-\d{2}T10:00:00\.000Z$/,
    );
  });

  it("does not mutate the reference date", () => {
    expiresAtFrom(relative(5, "days"), NOW);

    expect(NOW.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });

  it.each([0, -1, MAX_EXPIRY_AMOUNT + 1, 1.5, Number.NaN])(
    "rejects the invalid amount %s with a RangeError",
    (amount) => {
      expect(() => expiresAtFrom(relative(amount, "days"), NOW)).toThrow(RangeError);
    },
  );
});

function fromEntries(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("parseExpiryFormData", () => {
  it("parses never", () => {
    expect(parseExpiryFormData(fromEntries({ expiry_mode: "never" }))).toEqual({ mode: "never" });
  });

  it("parses keep", () => {
    expect(parseExpiryFormData(fromEntries({ expiry_mode: "keep" }))).toEqual({ mode: "keep" });
  });

  it("parses a relative amount and unit", () => {
    expect(
      parseExpiryFormData(
        fromEntries({ expiry_mode: "relative", expiry_amount: "30", expiry_unit: "days" }),
      ),
    ).toEqual({ mode: "relative", amount: 30, unit: "days" });
  });

  it("accepts both boundary amounts", () => {
    expect(
      parseExpiryFormData(
        fromEntries({ expiry_mode: "relative", expiry_amount: "1", expiry_unit: "hours" }),
      ),
    ).toEqual({ mode: "relative", amount: 1, unit: "hours" });
    expect(
      parseExpiryFormData(
        fromEntries({
          expiry_mode: "relative",
          expiry_amount: String(MAX_EXPIRY_AMOUNT),
          expiry_unit: "years",
        }),
      ),
    ).toEqual({ mode: "relative", amount: MAX_EXPIRY_AMOUNT, unit: "years" });
  });

  it.each([
    ["unknown mode", { expiry_mode: "sometimes" }],
    ["missing mode", {}],
    ["missing amount", { expiry_mode: "relative", expiry_unit: "days" }],
    ["empty amount", { expiry_mode: "relative", expiry_amount: "", expiry_unit: "days" }],
    ["text amount", { expiry_mode: "relative", expiry_amount: "soon", expiry_unit: "days" }],
    ["decimal amount", { expiry_mode: "relative", expiry_amount: "1.5", expiry_unit: "days" }],
    ["zero amount", { expiry_mode: "relative", expiry_amount: "0", expiry_unit: "days" }],
    ["too large amount", { expiry_mode: "relative", expiry_amount: "10001", expiry_unit: "days" }],
    ["missing unit", { expiry_mode: "relative", expiry_amount: "30" }],
    ["unknown unit", { expiry_mode: "relative", expiry_amount: "30", expiry_unit: "weeks" }],
  ])("returns null for an invalid form: %s", (_label, entries) => {
    expect(parseExpiryFormData(fromEntries(entries))).toBeNull();
  });
});
