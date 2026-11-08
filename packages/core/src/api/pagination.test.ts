import { describe, expect, it } from "vitest";
import { pageParams } from "./pagination";

function params(input: Record<string, string>): URLSearchParams {
  return new URLSearchParams(input);
}

describe("pageParams", () => {
  it("defaults to 20 rows from the first offset", () => {
    expect(pageParams(params({}))).toEqual({ limit: 20, offset: 0 });
  });

  it("reads valid limit and offset", () => {
    expect(pageParams(params({ limit: "2", offset: "4" }))).toEqual({ limit: 2, offset: 4 });
  });

  it("clamps a limit over the hard cap", () => {
    expect(pageParams(params({ limit: "1000" }))).toEqual({ limit: 100, offset: 0 });
  });

  it("clamps a limit below one", () => {
    expect(pageParams(params({ limit: "0" }))).toEqual({ limit: 1, offset: 0 });
    expect(pageParams(params({ limit: "-5" }))).toEqual({ limit: 1, offset: 0 });
  });

  it("falls back to the default for text that is not a number", () => {
    expect(pageParams(params({ limit: "many" }))).toEqual({ limit: 20, offset: 0 });
  });

  it("clamps a negative offset to zero", () => {
    expect(pageParams(params({ offset: "-3" }))).toEqual({ limit: 20, offset: 0 });
  });

  it("truncates fractional values", () => {
    expect(pageParams(params({ limit: "10.9", offset: "2.7" }))).toEqual({ limit: 10, offset: 2 });
  });

  it("honours a per-route default", () => {
    expect(pageParams(params({}), 50)).toEqual({ limit: 50, offset: 0 });
  });
});
