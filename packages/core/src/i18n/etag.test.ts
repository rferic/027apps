import { describe, expect, it } from "vitest";
import { computeEtag, parseEtag } from "./etag.js";

describe("computeEtag", () => {
  it("is a strong quoted sha256 of the JSON body", () => {
    const etag = computeEtag({ locale: "es", translations: { Email: "Correo" } });
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it("changes when the served body changes", () => {
    expect(computeEtag({ a: 1 })).not.toBe(computeEtag({ a: 2 }));
  });

  it("is stable for the same body", () => {
    expect(computeEtag({ a: 1, b: [2, 3] })).toBe(computeEtag({ a: 1, b: [2, 3] }));
  });

  it("parseEtag unwraps valid etags and rejects invalid ones", () => {
    const etag = computeEtag({ a: 1 });
    expect(parseEtag(etag)).toBe(etag.slice(1, -1));
    expect(parseEtag("nope")).toBeNull();
  });
});
