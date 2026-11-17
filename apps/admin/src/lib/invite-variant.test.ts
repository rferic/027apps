import { describe, expect, it } from "vitest";
import { inviteAppScheme, inviteVariant } from "./invite-variant";

describe("inviteVariant", () => {
  it("detects Android, iPhone and desktop", () => {
    expect(inviteVariant("Mozilla/5.0 (Linux; Android 14; Pixel)")).toBe("android");
    expect(inviteVariant("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe("ios");
    expect(inviteVariant("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
    expect(inviteVariant(null)).toBe("desktop");
  });
});

describe("inviteAppScheme", () => {
  it("uses the debug-only scheme on a local HTTP instance", () => {
    expect(inviteAppScheme("http:")).toBe("zero27apps-dev");
  });

  it("uses the production scheme over HTTPS", () => {
    expect(inviteAppScheme("https:")).toBe("zero27apps");
  });
});
