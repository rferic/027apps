import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("@/lib/instance-gate", () => ({ entryGate: vi.fn() }));
vi.mock("@/lib/instance-state", () => ({ readInstanceState: vi.fn() }));

import { proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  createServerClientMock.mockReset();
});

describe("proxy public help", () => {
  it("keeps the CSP without creating a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await proxy(new NextRequest("http://localhost/help/firebase"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy-report-only")).toContain("default-src");
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});

describe("proxy session cookies", () => {
  it("hardens the session cookie on the proxy client too", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
        getSession: async () => ({ data: { session: null } }),
      },
    });

    await proxy(new NextRequest("http://localhost:3003/members"));

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

describe("proxy cross-origin mutations", () => {
  it("rejects a cookie-authenticated API mutation from another origin before touching the session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await proxy(
      new NextRequest("http://panel.example.com/api/v1/users/u1", {
        method: "PATCH",
        headers: {
          cookie: "sb-project-ref-auth-token=token",
          origin: "https://evil.example",
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Cross-origin request rejected" },
    });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
