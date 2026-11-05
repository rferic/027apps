import { describe, expect, it } from "vitest";
import {
  checkLocales,
  checkPlaceholders,
  checkStaleness,
  extractPlaceholders,
  runCheck,
} from "./check.js";
import { SUPPORTED_LOCALES } from "./types.js";

const CATALOG = ["Email", "Hello {name}"];

/** All eight non-English locales carrying the catalog keys. */
function localesWith(overrides: Record<string, Record<string, string>> = {}) {
  const base: Record<string, Record<string, string>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === "en") continue;
    base[locale] = { Email: "Email translated", "Hello {name}": "Hola {name}" };
  }
  return { ...base, ...overrides };
}

describe("extractPlaceholders", () => {
  it("extracts named placeholders", () => {
    expect(extractPlaceholders("Hello {name} {surname}")).toEqual(new Set(["name", "surname"]));
  });

  it("ignores non-placeholder braces", () => {
    expect(extractPlaceholders("Use { for json")).toEqual(new Set());
  });
});

describe("checkLocales", () => {
  it("passes when every locale has exactly the catalog keys", () => {
    expect(checkLocales(CATALOG, localesWith())).toEqual({
      success: true,
      errors: [],
      warnings: [],
    });
  });

  it("fails when a locale is missing a key", () => {
    const result = checkLocales(CATALOG, localesWith({ es: { Email: "Correo" } }));
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("es: missing 1 key");
  });

  it("fails when a locale has an extra key", () => {
    const result = checkLocales(CATALOG, localesWith({ es: { ...localesWith().es, Extra: "x" } }));
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("es: extra 1 key");
  });

  it("fails when a locale file is missing", () => {
    const locales = localesWith();
    delete locales.ca;
    const result = checkLocales(CATALOG, locales);
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("ca: missing locale file");
  });
});

describe("checkPlaceholders", () => {
  it("passes when placeholders match", () => {
    expect(checkPlaceholders(CATALOG, localesWith()).success).toBe(true);
  });

  it("fails when a translation drops a placeholder", () => {
    const result = checkPlaceholders(CATALOG, localesWith({ es: { Email: "Correo", "Hello {name}": "Hola" } }));
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("placeholder mismatch");
  });
});

describe("checkStaleness", () => {
  it("passes when the code strings are all in the catalog", () => {
    const result = checkStaleness(CATALOG, ["Email"]);
    expect(result.success).toBe(true);
    // The unused catalog string is a warning, not an error.
    expect(result.warnings.length).toBe(1);
  });

  it("fails when the code uses a string missing from the catalog", () => {
    const result = checkStaleness(CATALOG, ["Email", "New string"]);
    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("missing from the catalog");
  });
});

describe("runCheck", () => {
  it("passes with a complete set", () => {
    const result = runCheck({ catalog: CATALOG, locales: localesWith(), codeStrings: CATALOG });
    expect(result).toEqual({ success: true, errors: [], warnings: [] });
  });
});
