import { describe, expect, it } from "vitest";
import { pageCount, pageHref, pageOffset, parsePage } from "./panel-pagination";

describe("panel pagination", () => {
  it("parses a 1-based page and falls back to the first page", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("2.9")).toBe(2);
  });

  it("maps a page to the fixed page-size offset", () => {
    expect(pageOffset(1)).toBe(0);
    expect(pageOffset(3)).toBe(40);
  });

  it("counts at least one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
  });

  it("keeps the active filters and omits page=1 and empty filters", () => {
    expect(pageHref("/members", { q: "ana" }, 1)).toBe("/members?q=ana");
    expect(pageHref("/members", { q: "ana" }, 3)).toBe("/members?q=ana&page=3");
    expect(pageHref("/keys", { state: "active", empty: undefined }, 2)).toBe(
      "/keys?state=active&page=2",
    );
    expect(pageHref("/modules", {}, 1)).toBe("/modules");
  });
});
