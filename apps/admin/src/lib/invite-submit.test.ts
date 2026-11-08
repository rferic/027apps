import { describe, expect, it, vi } from "vitest";
import { LOGIN_AFTER_REDEEM, submitInvite } from "./invite-submit";

const VALID = {
  token: "027_inv_abc123",
  email: "ana@example.com",
  password: "correct horse battery",
  confirmation: "correct horse battery",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("submitInvite", () => {
  it("replaces the history with the login notice after a 201", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ user: { id: "u1" } }, 201));
    const replace = vi.fn();

    const outcome = await submitInvite(VALID, { fetcher, replace });

    expect(outcome).toEqual({ kind: "redeemed" });
    expect(replace).toHaveBeenCalledWith(LOGIN_AFTER_REDEEM);
    expect(LOGIN_AFTER_REDEEM).toBe("/login?notice=invitation-redeemed");
  });

  it("does not send anything when the confirmation differs", async () => {
    const fetcher = vi.fn();
    const replace = vi.fn();

    const outcome = await submitInvite(
      { ...VALID, confirmation: "different password" },
      { fetcher, replace },
    );

    expect(outcome).toEqual({
      kind: "invalid",
      fieldErrors: { confirmation: "password_mismatch" },
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not send anything when the email is missing", async () => {
    const fetcher = vi.fn();

    const outcome = await submitInvite({ ...VALID, email: "" }, { fetcher });

    expect(outcome).toEqual({ kind: "invalid", fieldErrors: { email: "email_required" } });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the failure envelope without navigating", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: { code: "rate_limited" } }, 429));
    const replace = vi.fn();

    const outcome = await submitInvite(VALID, { fetcher, replace });

    expect(outcome).toEqual({ kind: "failed", failure: { ok: false, code: "rate_limited" } });
    expect(replace).not.toHaveBeenCalled();
  });

  it("returns a codeless failure when the network drops", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const outcome = await submitInvite(VALID, { fetcher });

    expect(outcome).toEqual({ kind: "failed", failure: { ok: false } });
  });
});
