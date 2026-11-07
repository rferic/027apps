import { describe, expect, it } from "vitest";

import { canUseClipboardApi } from "./clipboard";

describe("canUseClipboardApi", () => {
  it("is true in a secure context with the Clipboard API", () => {
    expect(canUseClipboardApi({ isSecureContext: true, hasClipboard: true })).toBe(true);
  });

  it("is false in an insecure context even if the API exists (plain HTTP on the LAN)", () => {
    expect(canUseClipboardApi({ isSecureContext: false, hasClipboard: true })).toBe(false);
  });

  it("is false without the Clipboard API", () => {
    expect(canUseClipboardApi({ isSecureContext: true, hasClipboard: false })).toBe(false);
  });

  it("is false when neither condition holds", () => {
    expect(canUseClipboardApi({ isSecureContext: false, hasClipboard: false })).toBe(false);
  });
});
