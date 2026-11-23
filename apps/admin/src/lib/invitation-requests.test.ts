import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const requestsHandlerMock = vi.fn();

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
  listInvitationRequestsRoute: () => requestsHandlerMock,
}));

import { loadInvitationRequests } from "./invitation-requests";

const REQUEST = {
  id: "r1",
  requester: { id: "u1", display_name: "Ana García", level: 1 },
  amount: 2,
  reason: "Para mi hermana",
  state: "pending",
  granted_amount: null,
  resolution_reason: null,
  resolved_by: null,
  resolved_at: null,
  created_at: "2026-11-18T00:00:00.000Z",
  quota: { level: 1, base: 5, granted: 1, used: 4, reserved: 2, remaining: 0, unlimited: false },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  requestsHandlerMock.mockReset();
});

describe("loadInvitationRequests", () => {
  it("calls the requests route in process with the session bearer", async () => {
    requestsHandlerMock.mockResolvedValue(json({ requests: [REQUEST], total: 1 }));

    await expect(loadInvitationRequests({ offset: 0 })).resolves.toEqual({
      ok: true,
      requests: [REQUEST],
      total: 1,
    });

    const req = requestsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(req.url).toBe("http://panel.internal/api/v1/invitation-requests?limit=20&offset=0");
    expect(req.method).toBe("GET");
    expect(req.headers.get("authorization")).toBe("Bearer token-123");
  });

  it("forwards the state filter to the route", async () => {
    requestsHandlerMock.mockResolvedValue(json({ requests: [REQUEST], total: 1 }));

    await loadInvitationRequests({ offset: 0, state: "pending" });

    const req = requestsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(req.url).toBe(
      "http://panel.internal/api/v1/invitation-requests?limit=20&offset=0&state=pending",
    );
  });

  it("rejects a malformed row instead of showing a partial list", async () => {
    requestsHandlerMock.mockResolvedValue(json({ requests: [{ id: "broken" }], total: 1 }));

    await expect(loadInvitationRequests({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("maps a bare 404 to not_found", async () => {
    requestsHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadInvitationRequests({ offset: 0 })).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });
});
