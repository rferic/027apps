import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redeem: vi.fn(),
  preview: vi.fn(),
  increment: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  profileQuery: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("@027apps/core/invitations/service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@027apps/core/invitations/service.js")>();
  return { ...actual, redeemInvitation: mocks.redeem };
});

vi.mock("@/lib/invite-preview", () => ({ loadInvitePreview: mocks.preview }));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({
    deps: { rateLimitStorage: { increment: mocks.increment } },
  }),
}));

vi.mock("@/lib/invitation-service-deps", () => ({
  invitationServiceDeps: async () => ({ db: { query: mocks.profileQuery } }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      origin: "https://familia.test",
      host: "familia.test",
      "x-forwarded-for": "203.0.113.9",
    }),
  cookies: async () => ({ set: mocks.setCookie }),
}));

import { DomainError } from "@027apps/core/errors.js";
import { submitInvitation } from "./actions";

const TOKEN = "027_inv_abc123";
const PREVIEW = {
  state: "pending",
  email: "ana@example.com",
  name: "Ana",
  role: "user",
  requires_identity: false,
  role_applies: true,
  account_exists: false,
  locale: "es",
  expires_at: "2026-11-24T12:00:00.000Z",
  inviter_name: "Eric",
  instance_name: "Familia Pérez",
  timezone: "Europe/Madrid",
};

function redeemed(role: "super_admin" | "admin" | "user") {
  return {
    user: { id: "u1", email: PREVIEW.email, display_name: "Ana", role },
    invitation_id: "i1",
  };
}

beforeEach(() => {
  mocks.redeem.mockReset();
  mocks.redeem.mockResolvedValue(redeemed("admin"));
  mocks.preview.mockReset();
  mocks.preview.mockResolvedValue(PREVIEW);
  mocks.increment.mockReset();
  mocks.increment.mockResolvedValue({ count: 1 });
  mocks.signIn.mockReset();
  mocks.signIn.mockResolvedValue({ data: { user: { id: "u-existing" } }, error: null });
  mocks.signOut.mockReset();
  mocks.profileQuery.mockReset();
  mocks.profileQuery.mockResolvedValue({ rows: [{ role: "admin" }] });
  mocks.setCookie.mockReset();
});

describe("submitInvitation", () => {
  it("signs in first for an existing account and redeems with its session", async () => {
    mocks.preview.mockResolvedValue({ ...PREVIEW, account_exists: true });

    const result = await submitInvitation({ token: TOKEN, password: "old-password" });

    expect(mocks.signIn).toHaveBeenCalledWith({
      email: PREVIEW.email,
      password: "old-password",
    });
    expect(mocks.redeem).toHaveBeenCalledWith(
      expect.anything(),
      TOKEN,
      { email: PREVIEW.email },
      { kind: "session", userId: "u-existing", role: "admin" },
    );
    expect(result).toEqual({ ok: true, role: "admin" });
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "027_locale",
      "es",
      expect.objectContaining({ path: "/" }),
    );
  });

  it("keeps a super_admin account in the panel and does not sign it out", async () => {
    mocks.preview.mockResolvedValue({ ...PREVIEW, account_exists: true });
    mocks.profileQuery.mockResolvedValue({ rows: [{ role: "super_admin" }] });
    mocks.redeem.mockResolvedValue(redeemed("super_admin"));

    const result = await submitInvitation({ token: TOKEN, password: "root-password" });

    expect(result).toEqual({ ok: true, role: "super_admin" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not redeem when the existing password is wrong", async () => {
    mocks.preview.mockResolvedValue({ ...PREVIEW, account_exists: true });
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid" } });

    const result = await submitInvitation({ token: TOKEN, password: "wrong-password" });

    expect(result).toEqual({ ok: false, code: "wrong_credentials" });
    expect(mocks.redeem).not.toHaveBeenCalled();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("redeems a new account and signs a panel role in", async () => {
    const result = await submitInvitation({ token: TOKEN, password: "a-new-password" });

    expect(mocks.redeem).toHaveBeenCalledWith(
      expect.anything(),
      TOKEN,
      { email: PREVIEW.email, password: "a-new-password" },
      { kind: "anon" },
    );
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: PREVIEW.email,
      password: "a-new-password",
    });
    expect(result).toEqual({ ok: true, role: "admin" });
  });

  it("redeems an anonymous invitation with the form's name and email", async () => {
    mocks.preview.mockResolvedValue({
      ...PREVIEW,
      requires_identity: true,
      email: null,
      name: null,
    });

    const result = await submitInvitation({
      token: TOKEN,
      password: "a-new-password",
      name: "Invitada",
      email: "invitee@example.com",
    });

    expect(mocks.redeem).toHaveBeenCalledWith(
      expect.anything(),
      TOKEN,
      { email: "invitee@example.com", name: "Invitada", password: "a-new-password" },
      { kind: "anon" },
    );
    expect(result).toEqual({ ok: true, role: "admin" });
  });

  it("signs in and retries with the session when an anonymous email already has an account", async () => {
    mocks.preview.mockResolvedValue({
      ...PREVIEW,
      requires_identity: true,
      email: null,
      name: null,
    });
    mocks.redeem
      .mockRejectedValueOnce(new DomainError("existing_account_signin_required"))
      .mockResolvedValueOnce(redeemed("user"));
    mocks.signIn.mockResolvedValue({ data: { user: { id: "u-existing" } }, error: null });
    mocks.profileQuery.mockResolvedValue({ rows: [{ role: "user" }] });

    const result = await submitInvitation({
      token: TOKEN,
      password: "current-password",
      name: "Invitada",
      email: "existing@example.com",
    });

    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "existing@example.com",
      password: "current-password",
    });
    expect(mocks.redeem).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      TOKEN,
      { email: "existing@example.com", name: "Invitada", password: "current-password" },
      { kind: "anon" },
    );
    expect(mocks.redeem).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      TOKEN,
      { email: "existing@example.com" },
      { kind: "session", userId: "u-existing", role: "user" },
    );
    expect(result).toEqual({ ok: true, role: "user" });
  });

  it("returns wrong_credentials when the anonymous email exists and the password is wrong", async () => {
    mocks.preview.mockResolvedValue({
      ...PREVIEW,
      requires_identity: true,
      email: null,
      name: null,
    });
    mocks.redeem.mockRejectedValueOnce(new DomainError("existing_account_signin_required"));
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid" } });

    const result = await submitInvitation({
      token: TOKEN,
      password: "wrong-password",
      name: "Invitada",
      email: "existing@example.com",
    });

    expect(result).toEqual({ ok: false, code: "wrong_credentials" });
    expect(mocks.redeem).toHaveBeenCalledTimes(1); // no retry: the invitation stays pending
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("rejects an anonymous redemption without a name or email", async () => {
    mocks.preview.mockResolvedValue({
      ...PREVIEW,
      requires_identity: true,
      email: null,
      name: null,
    });

    const result = await submitInvitation({ token: TOKEN, password: "a-new-password" });

    expect(result).toEqual({ ok: false, code: "validation_failed" });
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("does not keep a panel cookie for a plain member", async () => {
    mocks.redeem.mockResolvedValue(redeemed("user"));

    const result = await submitInvitation({ token: TOKEN, password: "a-new-password" });

    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(result).toEqual({ ok: true, role: "user" });
  });

  it("reports a failed automatic sign-in without losing the account", async () => {
    mocks.redeem.mockResolvedValue(redeemed("admin"));
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: { message: "nope" } });

    const result = await submitInvitation({ token: TOKEN, password: "a-new-password" });

    expect(result).toEqual({ ok: true, role: "admin", signInFailed: true });
  });

  it("refuses a used or expired invitation without redeeming", async () => {
    mocks.preview.mockResolvedValue({ ...PREVIEW, state: "used" });
    expect(await submitInvitation({ token: TOKEN, password: "a-new-password" })).toEqual({
      ok: false,
      code: "invitation_used",
    });

    mocks.preview.mockResolvedValue({ ...PREVIEW, state: "expired" });
    expect(await submitInvitation({ token: TOKEN, password: "a-new-password" })).toEqual({
      ok: false,
      code: "invitation_expired",
    });
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("hides an unknown token behind not_found", async () => {
    mocks.preview.mockResolvedValue(null);

    expect(await submitInvitation({ token: TOKEN, password: "a-new-password" })).toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("returns rate_limited before touching the invitation", async () => {
    mocks.increment.mockResolvedValue({ count: 31 });

    expect(await submitInvitation({ token: TOKEN, password: "a-new-password" })).toEqual({
      ok: false,
      code: "rate_limited",
    });
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it("validates the payload before any work", async () => {
    expect(await submitInvitation({ token: TOKEN, password: "" })).toEqual({
      ok: false,
      code: "validation_failed",
    });
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
