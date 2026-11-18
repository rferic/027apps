import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  isValidInviteToken,
  validateInviteForm,
} from "./invite-form";

const VALID = {
  password: "a".repeat(MIN_PASSWORD),
  confirmation: "a".repeat(MIN_PASSWORD),
};

describe("isValidInviteToken", () => {
  it("accepts the Core token shape", () => {
    expect(isValidInviteToken("027_inv_abc123")).toBe(true);
  });

  it("rejects a token without the prefix", () => {
    expect(isValidInviteToken("abc123")).toBe(false);
  });

  it("rejects a token longer than the Core limit", () => {
    expect(isValidInviteToken(`027_inv_${"a".repeat(193)}`)).toBe(false);
  });

  it("accepts a token of exactly 200 characters", () => {
    expect(isValidInviteToken(`027_inv_${"a".repeat(192)}`)).toBe(true);
  });
});

describe("validateInviteForm", () => {
  it("accepts a valid new-account form", () => {
    expect(validateInviteForm(VALID)).toEqual({});
  });

  it("requires a password", () => {
    expect(validateInviteForm({ password: "", confirmation: "" })).toEqual({
      password: "password_required",
    });
  });

  it("rejects a new password below the Core minimum", () => {
    expect(
      validateInviteForm({ password: "a".repeat(11), confirmation: "a".repeat(11) }),
    ).toEqual({ password: "password_short" });
  });

  it("rejects a password above the Core maximum", () => {
    const long = "a".repeat(MAX_PASSWORD + 1);
    expect(validateInviteForm({ password: long, confirmation: long })).toEqual({
      password: "password_long",
    });
  });

  it("rejects a confirmation that does not match", () => {
    expect(validateInviteForm({ ...VALID, confirmation: "b".repeat(MIN_PASSWORD) })).toEqual({
      confirmation: "password_mismatch",
    });
  });

  it("accepts a password of exactly 12 characters", () => {
    const password = "a".repeat(12);
    expect(validateInviteForm({ password, confirmation: password })).toEqual({});
  });

  it("does not impose the new-password floor on an existing account", () => {
    expect(
      validateInviteForm({ password: "old-pass", accountExists: true }),
    ).toEqual({});
  });

  it("still requires the current password", () => {
    expect(validateInviteForm({ password: "", accountExists: true })).toEqual({
      password: "password_required",
    });
  });

  it("does not ask for a confirmation on an existing account", () => {
    expect(
      validateInviteForm({ password: "old-pass", confirmation: "", accountExists: true }),
    ).toEqual({});
  });
});
