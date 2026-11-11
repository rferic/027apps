import { describe, expect, it } from "vitest";
import { postLoginPath } from "./post-login";

describe("postLoginPath", () => {
  it("sends a fully configured instance to the panel", () => {
    expect(postLoginPath(false)).toBe("/panel");
  });

  it("sends an instance with pending steps back to the wizard", () => {
    expect(postLoginPath(true)).toBe("/setup");
  });
});
