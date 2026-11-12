import { describe, expect, it } from "vitest";
import { landingHref, languageLabel, translator } from "./i18n";

describe("landingHref", () => {
  it("keeps English on the root routes", () => {
    expect(landingHref("en", "app")).toBe("/");
    expect(landingHref("en", "selfhost")).toBe("/self-host");
  });

  it("keeps one address for every language", () => {
    expect(landingHref("es", "app")).toBe("/");
    expect(landingHref("es", "selfhost")).toBe("/self-host");
    expect(landingHref("de", "cookies")).toBe("/cookies");
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
