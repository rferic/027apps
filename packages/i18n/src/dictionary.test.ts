import { describe, expect, it } from "vitest";
import { getDictionary } from "./dictionary.js";

describe("getDictionary", () => {
  it("returns the locale map from the repository catalog", () => {
    expect(getDictionary("es")["Step 1 · Environment"]).toBe("Paso 1 · Entorno");
  });

  it("returns an empty map for English (the key is the text)", () => {
    expect(getDictionary("en")).toEqual({});
  });

  it("returns an empty map for an unsupported locale value", () => {
    expect(getDictionary("xx" as never)).toEqual({});
  });
});
