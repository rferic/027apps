import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

import { createSupabaseServerClient } from "./server";

beforeEach(() => {
  createServerClientMock.mockReset();
  createServerClientMock.mockReturnValue({ auth: {} });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSupabaseServerClient", () => {
  it("hardens the session cookie (HttpOnly, SameSite=Lax, Secure in production)", async () => {
    await createSupabaseServerClient();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [, , options] = createServerClientMock.mock.calls[0] as [string, string, {
      cookieOptions: Record<string, unknown>;
    }];
    expect(options.cookieOptions).toMatchObject({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  });
});
