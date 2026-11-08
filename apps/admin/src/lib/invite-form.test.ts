import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  isValidInviteToken,
  validateInviteForm,
} from "./invite-form";

const VALID = {
  email: "ana@example.com",
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
  it("accepts a valid form", () => {
    expect(validateInviteForm(VALID)).toEqual({});
  });

  it("requires an email", () => {
    expect(validateInviteForm({ ...VALID, email: "  " })).toEqual({ email: "email_required" });
  });

  it("rejects a malformed email", () => {
    expect(validateInviteForm({ ...VALID, email: "not-an-email" })).toEqual({
      email: "email_invalid",
    });
  });

  it("rejects a password below the Core minimum", () => {
    expect(validateInviteForm({ ...VALID, password: "a".repeat(11), confirmation: "a".repeat(11) })).toEqual({
      password: "password_short",
    });
  });

  it("rejects a password above the Core maximum", () => {
    const long = "a".repeat(MAX_PASSWORD + 1);
    expect(validateInviteForm({ ...VALID, password: long, confirmation: long })).toEqual({
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
    expect(validateInviteForm({ email: VALID.email, password, confirmation: password })).toEqual({});
  });

  it("trims the email before checking it", () => {
    expect(validateInviteForm({ ...VALID, email: "  ana@example.com  " })).toEqual({});
  });
});
