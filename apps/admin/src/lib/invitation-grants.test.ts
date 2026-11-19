import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const grantsHandlerMock = vi.fn();
const invitationQuotaMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: () => getInfraMock(),
}));

vi.mock("@/lib/invitations-route-deps", () => ({
  invitationsRouteDeps: async () => ({}),
}));

vi.mock("@027apps/core/invitations/api.js", () => ({
  listInvitationGrantsRoute: () => grantsHandlerMock,
}));

vi.mock("@027apps/core/invitations/quota.js", () => ({
  invitationQuota: (...args: unknown[]) => invitationQuotaMock(...args),
}));

import { loadMemberInvitation } from "./invitation-grants";

const GRANT = {
  id: "g-1",
  user_id: "u-1",
  amount: 1,
  granted_by: { id: "a-1", display_name: "Eric" },
  request_id: null,
  reason: null,
  revoked_at: null,
  created_at: "2026-11-12T00:00:00.000Z",
};

const QUOTA = {
  level: 1,
  base: 5,
  granted: 1,
  used: 1,
  reserved: 1,
  remaining: 4,
  unlimited: false,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  getInfraMock.mockReset();
  getInfraMock.mockResolvedValue({ settingsDeps: { db: {} } });
  grantsHandlerMock.mockReset();
  invitationQuotaMock.mockReset();
});

describe("loadMemberInvitation", () => {
  it("returns the grants and the live quota for a member", async () => {
    grantsHandlerMock.mockResolvedValue(json({ grants: [GRANT] }));
    invitationQuotaMock.mockResolvedValue(QUOTA);

    await expect(loadMemberInvitation("u-1")).resolves.toEqual({
      ok: true,
      grants: [GRANT],
      quota: QUOTA,
    });

    const request = grantsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users/u-1/invitation-grants");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(invitationQuotaMock).toHaveBeenCalledWith({}, "u-1");
  });

  it("rejects a malformed grant instead of a partial list", async () => {
    grantsHandlerMock.mockResolvedValue(json({ grants: [{ id: "g-1" }] }));

    await expect(loadMemberInvitation("u-1")).resolves.toEqual({ ok: false });
  });

  it("returns the public code and request id on a 500", async () => {
    grantsHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500, {
        "x-request-id": "req-header",
      }),
    );

    await expect(loadMemberInvitation("u-1")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("redirects to login when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadMemberInvitation("u-1")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(grantsHandlerMock).not.toHaveBeenCalled();
  });
});
