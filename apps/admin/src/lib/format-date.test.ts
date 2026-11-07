import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, resolveTimeZone } from "./format-date";

/** 23:30 UTC is already the next calendar day in Europe/Madrid. */
const LATE_UTC = "2026-11-06T23:30:00Z";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatDate", () => {
  it("formats the instant in the instance time zone, not the server zone", () => {
    const madrid = formatDate(LATE_UTC, { locale: "en", timeZone: "Europe/Madrid" });
    const utc = formatDate(LATE_UTC, { locale: "en", timeZone: "UTC" });

    expect(madrid).toBe("Nov 7, 2026");
    expect(utc).toBe("Nov 6, 2026");
  });

  it("always passes an explicit timeZone to Intl.DateTimeFormat", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat");

    formatDate(LATE_UTC, { locale: "en", timeZone: "Europe/Madrid" });

    const formatCall = spy.mock.calls.find(
      ([, options]) => options !== undefined && "day" in options,
    );
    expect(formatCall).toBeDefined();
    expect(formatCall?.[1]).toMatchObject({ timeZone: "Europe/Madrid" });
  });

  it("falls back to UTC when the configured zone is not valid", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat");

    const formatted = formatDate(LATE_UTC, { locale: "en", timeZone: "Not/AZone" });

    expect(formatted).toBe("Nov 6, 2026");
    const formatCall = spy.mock.calls.find(
      ([, options]) => options !== undefined && "day" in options,
    );
    expect(formatCall?.[1]).toMatchObject({ timeZone: "UTC" });
  });

  it("renders an em dash for an unparsable value", () => {
    expect(formatDate("not-a-date", { locale: "en", timeZone: "UTC" })).toBe("—");
  });
});

describe("resolveTimeZone", () => {
  it("keeps a valid IANA zone", () => {
    expect(resolveTimeZone("Europe/Madrid")).toBe("Europe/Madrid");
  });

  it("falls back to UTC for empty, non-string or invalid values", () => {
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(resolveTimeZone(42)).toBe("UTC");
    expect(resolveTimeZone("Mars/Olympus")).toBe("UTC");
  });
});
