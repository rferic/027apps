import { describe, expect, it } from "vitest";
import { cookieValue, themeBootstrapScript, themeCookie, themeFromCookie } from "./theme";

describe("themeFromCookie", () => {
  it("keeps the three supported values", () => {
    expect(themeFromCookie("system")).toBe("system");
    expect(themeFromCookie("light")).toBe("light");
    expect(themeFromCookie("dark")).toBe("dark");
  });

  it("falls back to system for a missing cookie", () => {
    expect(themeFromCookie(undefined)).toBe("system");
    expect(themeFromCookie(null)).toBe("system");
    expect(themeFromCookie("")).toBe("system");
  });

  it("rejects hostile or unknown values", () => {
    expect(themeFromCookie("<script>alert(1)</script>")).toBe("system");
    expect(themeFromCookie("DARK")).toBe("system");
    expect(themeFromCookie("blue")).toBe("system");
  });
});

describe("themeCookie", () => {
  it("serializes a non-session theme cookie", () => {
    const cookie = themeCookie("dark");
    expect(cookie).toContain("027_theme=dark");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).not.toContain("HttpOnly");
    expect(cookie).not.toContain("Secure");
  });
});

describe("cookieValue", () => {
  it("reads one cookie out of the document cookie string", () => {
    expect(cookieValue("027_locale=es; 027_theme=light", "027_theme")).toBe("light");
    expect(cookieValue("027_theme=dark", "027_theme")).toBe("dark");
  });

  it("returns null when the cookie is absent", () => {
    expect(cookieValue("027_locale=es", "027_theme")).toBeNull();
    expect(cookieValue("", "027_theme")).toBeNull();
  });
});

describe("themeBootstrapScript", () => {
  const script = themeBootstrapScript();

  it("reads the stored theme before paint", () => {
    expect(script).toContain("027_theme");
    expect(script).toContain('classList.toggle("dark"');
    expect(script).toContain('classList.toggle("light"');
  });

  it("does not override an explicit ?lang", () => {
    expect(script).toContain("[?&]lang=");
  });

  it("sets the document language from the cookie otherwise", () => {
    expect(script).toContain("027_locale");
    expect(script).toContain("r.lang=l[1]");
  });
});
