import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
}));

import { confirmRecoveryAction } from "./actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const VALID = {
  token_hash: "hash-123",
  type: "recovery",
  next: "/reset-password",
};

async function run(data: FormData): Promise<void> {
  await expect(confirmRecoveryAction(data)).rejects.toThrow("redirect:");
}

beforeEach(() => {
  mocks.redirect.mockReset();
  mocks.verifyOtp.mockReset();
  mocks.verifyOtp.mockResolvedValue({ error: null });
});

describe("confirmRecoveryAction", () => {
  it("verifies the token and continues to the reset form", async () => {
    await run(form(VALID));

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash-123",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/reset-password");
  });

  it("rejects a type that is not recovery without verifying", async () => {
    await run(form({ ...VALID, type: "invite" }));

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?notice=invalid");
  });

  it("rejects a next outside the allowlist without verifying", async () => {
    await run(form({ ...VALID, next: "https://evil.example" }));

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?notice=invalid");
  });

  it("rejects an empty token", async () => {
    await run(form({ ...VALID, token_hash: "" }));

    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?notice=invalid");
  });

  it("sends an invalid or expired token back to the request page", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { message: "expired" } });

    await run(form(VALID));

    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?notice=invalid");
  });
});
