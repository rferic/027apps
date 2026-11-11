import { describe, expect, it } from "vitest";
import {
  LANDING_LOCALES,
  landingHref,
  languageLabel,
  translator,
} from "./i18n";

describe("landingHref", () => {
  it("keeps English on the root routes", () => {
    expect(landingHref("en", "app")).toBe("/");
    expect(landingHref("en", "selfhost")).toBe("/self-host");
  });

  it("prefixes the translated variants", () => {
    expect(landingHref("es", "app")).toBe("/l/es");
    expect(landingHref("es", "selfhost")).toBe("/l/es/self-host");
  });

  it("lists the eight translated languages, without English", () => {
    expect(LANDING_LOCALES).toHaveLength(8);
    expect(LANDING_LOCALES).not.toContain("en");
  });
});

describe("languageLabel", () => {
  it("shows the short code of the current language", () => {
    expect(languageLabel("en")).toBe("EN");
    expect(languageLabel("de")).toBe("DE");
  });
});

describe("translator", () => {
  it("translates a known landing string", () => {
    expect(translator("es")("Everything ready")).toBe("Todo listo");
  });

  it("falls back to English when a key has no translation", () => {
    expect(translator("de")("Not a landing string")).toBe("Not a landing string");
  });
});
