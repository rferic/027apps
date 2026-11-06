import { describe, expect, it } from "vitest";
import { isSupportedLocale, localeCookie, resolveLocale } from "./locale";

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

  it("falls back to English for an invalid cookie", () => {
    expect(resolveLocale({ cookie: "invalid" })).toBe("en");
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
