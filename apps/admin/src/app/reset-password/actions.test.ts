import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  increment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    throw new Error(`redirect:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({
    deps: { rateLimitStorage: { increment: mocks.increment } },
  }),
}));

vi.mock("@/lib/active-profile", () => ({
  isActiveProfile: async () => true,
}));

import { resetPasswordAction } from "./actions";

function form(password: string, confirmation: string): FormData {
  const data = new FormData();
  data.set("password", password);
  data.set("confirmation", confirmation);
  return data;
}

async function run(data: FormData): Promise<void> {
  await expect(resetPasswordAction(data)).rejects.toThrow("redirect:");
}

beforeEach(() => {
  mocks.redirect.mockReset();
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.updateUser.mockReset();
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockReset();
  mocks.increment.mockReset();
  mocks.increment.mockResolvedValue({ count: 1 });
});

describe("resetPasswordAction", () => {
  it("saves the password, revokes other sessions and closes the local one", async () => {
    await run(form("a-new-password-123", "a-new-password-123"));

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "a-new-password-123" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).toHaveBeenCalledWith("/login?notice=password-reset");
  });

  it("rejects a short password before touching Supabase", async () => {
    await run(form("short", "short"));

    expect(mocks.redirect).toHaveBeenCalledWith("/reset-password?error=short");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", async () => {
    await run(form("a-new-password-123", "another-password-123"));

    expect(mocks.redirect).toHaveBeenCalledWith("/reset-password?error=mismatch");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("sends a sessionless visitor back to request a link", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await run(form("a-new-password-123", "a-new-password-123"));

    expect(mocks.redirect).toHaveBeenCalledWith("/forgot-password");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("applies the per-user reset budget", async () => {
    mocks.increment.mockResolvedValue({ count: 6 });

    await run(form("a-new-password-123", "a-new-password-123"));

    expect(mocks.redirect).toHaveBeenCalledWith("/reset-password?error=rate_limited");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("reports an update failure without signing out", async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: "same password" } });

    await run(form("a-new-password-123", "a-new-password-123"));

    expect(mocks.redirect).toHaveBeenCalledWith("/reset-password?error=invalid");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
