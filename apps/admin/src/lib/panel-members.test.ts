import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const queryMock = vi.fn();
const usersHandlerMock = vi.fn();
const userHandlerMock = vi.fn();

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
  withTransactionClient: vi.fn(),
}));

vi.mock("@027apps/core/users/api.js", () => ({
  usersRoute: () => usersHandlerMock,
  userRoute: () => userHandlerMock,
}));

import { loadMember, loadMembers } from "./panel-members";

const USERS = [
  {
    id: "u1",
    display_name: "Ana",
    locale: "es",
    timezone: "Europe/Madrid",
    role: "super_admin",
    created_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
  },
  {
    id: "u2",
    display_name: "Luis",
    locale: "en",
    timezone: "UTC",
    role: "admin",
    created_at: "2026-02-01T00:00:00.000Z",
    deactivated_at: "2026-03-01T00:00:00.000Z",
  },
];

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  getInfraMock.mockReset();
  getInfraMock.mockResolvedValue({
    deps: {},
    auth: {},
    settingsDeps: { db: { query: queryMock } },
  });
  queryMock.mockReset();
  queryMock.mockResolvedValue({
    rows: [
      { id: "u1", email: "ana@example.com" },
      { id: "u2", email: "luis@example.com" },
    ],
  });
  usersHandlerMock.mockReset();
  userHandlerMock.mockReset();
});

describe("loadMembers", () => {
  it("calls the users route in process with q, a fixed limit and the offset", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 45, active_total: 40 }));

    const result = await loadMembers({ q: "ana", offset: 20 });

    expect(result).toMatchObject({ ok: true, total: 45, activeTotal: 40 });
    expect(result.ok && result.users[0]).toMatchObject({
      id: "u1",
      display_name: "Ana",
      email: "ana@example.com",
      role: "super_admin",
    });
    expect(result.ok && result.users[1]?.email).toBe("luis@example.com");

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users?q=ana&limit=20&offset=20");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("host")).toBeNull();
    expect(request.headers.get("x-forwarded-host")).toBeNull();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("auth.users"), [["u1", "u2"]]);
  });

  it("omits q when the filter is empty and starts at offset 0", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 2, active_total: 1 }));

    await loadMembers({ offset: 0 });

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users?limit=20&offset=0");
  });

  it("keeps the instance-wide total when the page only holds 20 rows", async () => {
    const page = Array.from({ length: 20 }, (_, index) => ({
      ...USERS[0],
      id: `u-${index}`,
      display_name: `Member ${index}`,
    }));
    usersHandlerMock.mockResolvedValue(json({ users: page, total: 45, active_total: 44 }));

    const result = await loadMembers({ offset: 0 });

    expect(result).toMatchObject({ ok: true, total: 45, activeTotal: 44 });
    expect(result.ok && result.users).toHaveLength(20);
  });

  it("returns the public code and request id on a 500", async () => {
    usersHandlerMock.mockResolvedValue(
      json(
        { error: { code: "internal", message: "Internal server error", request_id: "req-500" } },
        500,
        { "x-request-id": "req-header" },
      ),
    );

    await expect(loadMembers({ offset: 0 })).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a malformed row instead of showing a partial table", async () => {
    usersHandlerMock.mockResolvedValue(
      json({ users: [USERS[0], { id: "broken", display_name: "Broken" }], total: 2, active_total: 2 }),
    );

    await expect(loadMembers({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("rejects a non-numeric total", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: [], total: "45", active_total: 45 }));

    await expect(loadMembers({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("keeps the header request id when a 2xx body has an invalid shape", async () => {
    usersHandlerMock.mockResolvedValue(
      json({ users: "not-an-array" }, 200, { "x-request-id": "req-shape" }),
    );

    await expect(loadMembers({ offset: 0 })).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });

  it("redirects to login when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadMembers({ offset: 0 })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(usersHandlerMock).not.toHaveBeenCalled();
  });
});

describe("loadMember", () => {
  it("returns the member with the auth email", async () => {
    userHandlerMock.mockResolvedValue(json({ user: USERS[0] }));

    const result = await loadMember("u1");

    expect(result).toMatchObject({
      ok: true,
      member: { id: "u1", email: "ana@example.com", role: "super_admin" },
    });
    const request = userHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users/u1");
    const id = userHandlerMock.mock.calls[0]?.[1] as string;
    expect(id).toBe("u1");
  });

  it("turns a 404 into a not_found result (and never into an empty detail)", async () => {
    userHandlerMock.mockResolvedValue(
      json({ error: { code: "not_found", request_id: "req-404" } }, 404),
    );

    await expect(loadMember("missing")).resolves.toEqual({
      ok: false,
      code: "not_found",
      requestId: "req-404",
    });
  });

  it("infers not_found from a bare 404 without an envelope", async () => {
    userHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadMember("missing")).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("keeps the request id of a 500", async () => {
    userHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500),
    );

    await expect(loadMember("u1")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a malformed detail body", async () => {
    userHandlerMock.mockResolvedValue(json({ user: { id: "u1", display_name: "Ana" } }));

    await expect(loadMember("u1")).resolves.toEqual({ ok: false });
  });
});
