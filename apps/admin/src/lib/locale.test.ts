import { describe, expect, it } from "vitest";
import { filterMultiSelectOptions } from "@/components/ui/multi-select";
import { isSupportedLocale, localeCookie, localeFromAcceptLanguage, localeOptions, resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it("defaults to English with empty input", () => {
    expect(resolveLocale({})).toBe("en");
  });

  it("prefers a valid query locale over the cookie", () => {
    expect(resolveLocale({ query: "es", cookie: "de" })).toBe("es");
  });

  it("falls through an invalid query to a valid cookie", () => {
    expect(resolveLocale({ query: "invalid", cookie: "ca" })).toBe("ca");
  });

  it("falls back to the browser language when there is no cookie", () => {
    expect(resolveLocale({ acceptLanguage: "es-ES,es;q=0.9,en;q=0.8" })).toBe("es");
    expect(resolveLocale({ acceptLanguage: "fr-CA,fr;q=0.9" })).toBe("fr");
  });

  it("defaults to English when neither the cookie nor the browser match", () => {
    expect(resolveLocale({ cookie: "invalid", acceptLanguage: "ja-JP,ja;q=0.9" })).toBe("en");
  });

  it("rejects hostile locale values", () => {
    const hostile = "<script>alert(1)</script>";
    expect(resolveLocale({ query: hostile, cookie: hostile })).toBe("en");
    expect(isSupportedLocale(hostile)).toBe(false);
  });
});

describe("localeCookie", () => {
  it("serializes a non-session locale cookie", () => {
    const cookie = localeCookie("es");
    expect(cookie).toContain("027_locale=es");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");
  });
});

describe("localeOptions", () => {
  it("lists the nine locales by native name with the code as hint", () => {
    expect(localeOptions()).toEqual([
      { value: "en", label: "English", hint: "en", fixed: true },
      { value: "es", label: "Español", hint: "es", fixed: false },
      { value: "ca", label: "Català", hint: "ca", fixed: false },
      { value: "it", label: "Italiano", hint: "it", fixed: false },
      { value: "fr", label: "Français", hint: "fr", fixed: false },
      { value: "de", label: "Deutsch", hint: "de", fixed: false },
      { value: "pt", label: "Português", hint: "pt", fixed: false },
      { value: "gl", label: "Galego", hint: "gl", fixed: false },
      { value: "eu", label: "Euskara", hint: "eu", fixed: false },
    ]);
  });

  it("filters by native name and by code, ignoring case and accents", () => {
    const options = localeOptions();
    expect(filterMultiSelectOptions(options, "catala").map((option) => option.value)).toEqual(["ca"]);
    expect(filterMultiSelectOptions(options, "euskara").map((option) => option.value)).toEqual(["eu"]);
    expect(filterMultiSelectOptions(options, "FR").map((option) => option.value)).toEqual(["fr"]);
    expect(filterMultiSelectOptions(options, "pt").map((option) => option.value)).toEqual(["pt"]);
  });

  it("only marks English as fixed", () => {
    expect(localeOptions().filter((option) => option.fixed).map((option) => option.value)).toEqual([
      "en",
    ]);
  });
});

describe("localeFromAcceptLanguage", () => {
  it("respects quality order and region tags", () => {
    expect(localeFromAcceptLanguage("de-DE;q=0.5, pt-BR;q=0.9")).toBe("pt");
    expect(localeFromAcceptLanguage("ca-ES")).toBe("ca");
  });

  it("ignores unsupported languages and defaults to English", () => {
    expect(localeFromAcceptLanguage("ja,ko;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });
});
