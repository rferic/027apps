import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }),
}));

vi.mock("@/lib/password-recovery-deps", () => ({
  passwordRecoveryDeps: async () => ({ fake: true }),
}));

vi.mock("@027apps/core/auth/password-recovery.js", () => ({
  requestPasswordReset: mocks.reset,
}));

import { requestResetAction } from "./actions";

function form(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

async function run(email: string): Promise<void> {
  await expect(requestResetAction(form(email))).rejects.toThrow("redirect:");
}

beforeEach(() => {
  mocks.redirect.mockReset();
  mocks.reset.mockReset();
  mocks.reset.mockResolvedValue(undefined);
});

describe("requestResetAction", () => {
  it("asks for the reset and always answers with the neutral page", async () => {
    await run("ana@example.com");

    expect(mocks.reset).toHaveBeenCalledWith(
      { fake: true },
      { email: "ana@example.com", ip: "203.0.113.5" },
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?sent=1");
  });

  it("still answers neutrally for a malformed email without calling the service", async () => {
    await run("not-an-email");

    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password?sent=1");
  });
});
