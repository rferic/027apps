import { describe, expect, it, vi } from "vitest";
import { submitInvite } from "./invite-submit";

const VALID = {
  token: "027_inv_abc123",
  password: "correct horse battery",
  confirmation: "correct horse battery",
};

describe("submitInvite", () => {
  it("reports the effective role after a redemption", async () => {
    const submit = vi.fn(async () => ({ ok: true as const, role: "admin" as const }));

    const outcome = await submitInvite(VALID, { submit });

    expect(outcome).toEqual({ kind: "redeemed", role: "admin" });
    expect(submit).toHaveBeenCalledWith({ token: VALID.token, password: VALID.password });
  });

  it("passes the welcome notice when the automatic sign-in failed", async () => {
    const submit = vi.fn(async () => ({
      ok: true as const,
      role: "admin" as const,
      signInFailed: true,
    }));

    const outcome = await submitInvite(VALID, { submit });

    expect(outcome).toEqual({ kind: "redeemed", role: "admin", signInFailed: true });
  });

  it("does not send anything when the confirmation differs", async () => {
    const submit = vi.fn();

    const outcome = await submitInvite(
      { ...VALID, confirmation: "different password" },
      { submit },
    );

    expect(outcome).toEqual({
      kind: "invalid",
      fieldErrors: { confirmation: "password_mismatch" },
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("returns the failure code without a navigation", async () => {
    const submit = vi.fn(async () => ({ ok: false as const, code: "rate_limited" }));

    const outcome = await submitInvite(VALID, { submit });

    expect(outcome).toEqual({ kind: "failed", failure: { ok: false, code: "rate_limited" } });
  });

  it("does not ask for a confirmation when the account exists", async () => {
    const submit = vi.fn(async () => ({ ok: true as const, role: "user" as const }));

    const outcome = await submitInvite(
      { token: VALID.token, password: "old-pass", confirmation: "", accountExists: true },
      { submit },
    );

    expect(outcome).toEqual({ kind: "redeemed", role: "user" });
    expect(submit).toHaveBeenCalledWith({ token: VALID.token, password: "old-pass" });
  });

  it("collects the name and email on an anonymous invitation", async () => {
    const submit = vi.fn(async () => ({ ok: true as const, role: "user" as const }));

    const outcome = await submitInvite(
      {
        token: VALID.token,
        password: VALID.password,
        confirmation: VALID.confirmation,
        name: "Invitada",
        email: "invitee@example.com",
        requiresIdentity: true,
      },
      { submit },
    );

    expect(outcome).toEqual({ kind: "redeemed", role: "user" });
    expect(submit).toHaveBeenCalledWith({
      token: VALID.token,
      password: VALID.password,
      name: "Invitada",
      email: "invitee@example.com",
    });
  });

  it("carries the existing-account notice to the welcome page", async () => {
    const submit = vi.fn(async () => ({
      ok: true as const,
      role: "user" as const,
      existingAccount: true as const,
    }));

    const outcome = await submitInvite(VALID, { submit });

    expect(outcome).toEqual({ kind: "redeemed", role: "user", existingAccount: true });
  });

  it("requires the name and email on an anonymous invitation", async () => {
    const submit = vi.fn();

    const outcome = await submitInvite(
      {
        token: VALID.token,
        password: VALID.password,
        confirmation: VALID.confirmation,
        requiresIdentity: true,
      },
      { submit },
    );

    expect(outcome).toEqual({
      kind: "invalid",
      fieldErrors: { name: "name_required", email: "email_required" },
    });
    expect(submit).not.toHaveBeenCalled();
  });
});
