import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("une valores no vacíos con un espacio", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("descarta false, null y undefined", () => {
    expect(cn("a", false, null, "b", undefined)).toBe("a b");
  });

  it("devuelve string vacío sin argumentos útiles", () => {
    expect(cn()).toBe("");
    expect(cn(false, null)).toBe("");
  });
});