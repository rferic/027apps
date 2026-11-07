import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const invitationsHandlerMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@/lib/invitations-route-deps", () => ({
  invitationsRouteDeps: async () => ({}),
}));

vi.mock("@027apps/core/invitations/api.js", () => ({
  invitationsRoute: () => invitationsHandlerMock,
}));

import { loadInvitations } from "./panel-invitations";

const INVITATION = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: "c1",
  modules: ["expenses"],
  status: "pending",
  expires_at: "2026-12-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-11-01T00:00:00.000Z",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  invitationsHandlerMock.mockReset();
});

describe("loadInvitations", () => {
  it("calls the invitations route in process with the session bearer", async () => {
    invitationsHandlerMock.mockResolvedValue(json({ invitations: [INVITATION], total: 1 }));

    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({
      ok: true,
      invitations: [INVITATION],
      total: 1,
    });

    const req = invitationsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(req.url).toBe("http://panel.internal/api/v1/invitations?limit=20&offset=0");
    expect(req.method).toBe("GET");
    expect(req.headers.get("authorization")).toBe("Bearer token-123");
    expect(req.headers.get("host")).toBeNull();
  });

  it("keeps a category-less invitation with a null category id", async () => {
    invitationsHandlerMock.mockResolvedValue(
      json({ invitations: [{ ...INVITATION, user_category_id: null }], total: 1 }),
    );

    const result = await loadInvitations({ offset: 0 });

    expect(result.ok && result.invitations[0]?.user_category_id).toBeNull();
  });

  it("maps a bare 404 to not_found", async () => {
    invitationsHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("returns the public code and request id on a 500", async () => {
    invitationsHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500, {
        "x-request-id": "req-header",
      }),
    );

    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects an unknown status instead of guessing", async () => {
    invitationsHandlerMock.mockResolvedValue(
      json({ invitations: [{ ...INVITATION, status: "unknown" }], total: 1 }),
    );

    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("rejects malformed module lists and dates", async () => {
    invitationsHandlerMock.mockResolvedValue(
      json({ invitations: [{ ...INVITATION, modules: "expenses" }], total: 1 }),
    );
    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({ ok: false });

    invitationsHandlerMock.mockResolvedValue(
      json({ invitations: [{ ...INVITATION, expires_at: undefined }], total: 1 }),
    );
    await expect(loadInvitations({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("redirects to login without an access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadInvitations({ offset: 0 })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(invitationsHandlerMock).not.toHaveBeenCalled();
  });
});
