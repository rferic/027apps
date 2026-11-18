import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut: signOutMock } }),
}));

import { GET } from "./route";

afterEach(() => {
  signOutMock.mockReset();
});

describe("GET /logout", () => {
  it("signs out locally and returns to login", async () => {
    signOutMock.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("http://localhost/logout?reason=access_revoked"));

    expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?reason=access_revoked",
    );
  });

  it("rejects a cross-site navigation without touching the session", async () => {
    const response = await GET(
      new NextRequest("http://localhost/logout", {
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );

    expect(signOutMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/panel");
  });

  it("still clears the Supabase cookies when signOut fails", async () => {
    signOutMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await GET(
      new NextRequest("http://localhost/logout", {
        headers: { cookie: "sb-project-auth-token=stale" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toContain("sb-project-auth-token=");
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("expires=");
    expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("1970");
  });
});
