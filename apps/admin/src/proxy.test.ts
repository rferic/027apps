import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const createServerClientMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("@/lib/instance-gate", () => ({ entryGate: vi.fn() }));
vi.mock("@/lib/instance-state", () => ({ readInstanceState: vi.fn() }));

import { proxy } from "./proxy";
import { readInstanceState } from "@/lib/instance-state";

afterEach(() => {
  vi.unstubAllEnvs();
  createServerClientMock.mockReset();
  vi.mocked(readInstanceState).mockReset();
});

describe("proxy public help", () => {
  it("keeps both CSP headers without creating a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await proxy(new NextRequest("http://localhost/help/firebase"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(response.headers.get("content-security-policy-report-only")).toContain("default-src");
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});

describe("proxy public invitation", () => {
  it("renders an invitation page without a Supabase client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await proxy(new NextRequest("http://localhost/invite/027_inv_abc123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy-report-only")).toContain(
      "frame-ancestors 'none'",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("keeps /invite with more than one segment on the private path", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(proxy(new NextRequest("http://localhost/invite/a/b"))).rejects.toThrow(
      "Supabase env vars are not configured",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("keeps a panel route on the private path", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(proxy(new NextRequest("http://localhost/members"))).rejects.toThrow(
      "Supabase env vars are not configured",
    );
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

    const response = await proxy(new NextRequest("http://localhost:3003/members"));

    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("content-security-policy-report-only")).toContain(
      "connect-src 'self' https://project.supabase.co",
    );
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

describe("proxy API session", () => {
  function browserClient() {
    const getUser = vi.fn(async () => ({ data: { user: { id: "u1" } } }));
    const getSession = vi.fn(async () => ({
      data: { session: { access_token: "access-token" } },
    }));
    createServerClientMock.mockReturnValue({ auth: { getUser, getSession } });
    return { getUser, getSession };
  }

  it("forwards the access token without verifying the JWT twice", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const { getUser, getSession } = browserClient();

    const response = await proxy(new NextRequest("http://localhost/api/v1/instance"));

    // The door verifies the JWT with `getUser`; the proxy only forwards it.
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(getUser).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-request-authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("leaves the panel verification to the layout and only refreshes the cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const { getUser, getSession } = browserClient();

    await proxy(new NextRequest("http://localhost/members"));

    // The panel layout verifies the session; the proxy only keeps the cookie fresh.
    expect(getUser).not.toHaveBeenCalled();
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("verifies the session on the gated entry pages", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.mocked(readInstanceState).mockResolvedValue({ installed: true, setupIncomplete: false });
    const { getUser, getSession } = browserClient();

    await proxy(new NextRequest("http://localhost/login"));

    // The entry gate decides with `hasSession`, so this page needs the check.
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("sends no Authorization header when the cookie has no session", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null } })),
        getSession: vi.fn(async () => ({ data: { session: null } })),
      },
    });

    const response = await proxy(new NextRequest("http://localhost/api/v1/instance"));

    expect(response.headers.get("x-middleware-request-authorization")).toBeNull();
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
