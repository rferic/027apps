import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins non-empty values with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("discards false, null and undefined", () => {
    expect(cn("a", false, null, "b", undefined)).toBe("a b");
  });

  it("returns an empty string with no useful arguments", () => {
    expect(cn()).toBe("");
    expect(cn(false, null)).toBe("");
  });
});
