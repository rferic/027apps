import { afterEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: signOutMock } }),
}));

import { signOutAction } from "./actions";

afterEach(() => {
  signOutMock.mockReset();
});

describe("signOutAction", () => {
  it("ends only this browser's session", async () => {
    signOutMock.mockResolvedValue({ error: null });

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
  });
});
