import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const queryMock = vi.fn();
const loggerMock = vi.fn();
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
    categories: [
      { id: "c1", name: "Alpha" },
      { id: "c2", name: "Beta" },
    ],
  },
  {
    id: "u2",
    display_name: "Luis",
    locale: "en",
    timezone: "UTC",
    role: "admin",
    created_at: "2026-02-01T00:00:00.000Z",
    deactivated_at: "2026-03-01T00:00:00.000Z",
    categories: [],
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
    deps: { logger: loggerMock },
    auth: {},
    settingsDeps: { db: { query: queryMock } },
  });
  loggerMock.mockReset();
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
      categories: [
        { id: "c1", name: "Alpha" },
        { id: "c2", name: "Beta" },
      ],
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

  it("sends the role and state filters to the API", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 0, active_total: 0 }));

    await loadMembers({ role: "user", state: "deactivated", offset: 0 });

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/users?role=user&state=deactivated&limit=20&offset=0",
    );
  });

  it("sends state=all explicitly when the reader chooses every state", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 2, active_total: 1 }));

    await loadMembers({ state: "all", offset: 0 });

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users?state=all&limit=20&offset=0");
  });

  it("sends the category filter to the API", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 2, active_total: 1 }));

    await loadMembers({
      category: "11111111-1111-4111-8111-111111111111",
      offset: 0,
    });

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(
      "http://panel.internal/api/v1/users?category=11111111-1111-4111-8111-111111111111&limit=20&offset=0",
    );
  });

  it("rejects a row whose categories are malformed", async () => {
    usersHandlerMock.mockResolvedValue(
      json({
        users: [{ ...USERS[0], categories: [{ id: "c1" }] }],
        total: 1,
        active_total: 1,
      }),
    );

    await expect(loadMembers({ offset: 0 })).resolves.toEqual({ ok: false });
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

  it("distinguishes an account without email from a failed lookup", async () => {
    usersHandlerMock.mockImplementation(async () => json({ users: USERS, total: 2, active_total: 1 }));
    queryMock.mockResolvedValue({ rows: [{ id: "u1", email: "ana@example.com" }] });

    const withMissing = await loadMembers({ offset: 0 });

    expect(withMissing.ok && withMissing.users[1]).toMatchObject({
      id: "u2",
      email: null,
      emailUnavailable: false,
    });

    queryMock.mockRejectedValue(new Error("database down"));
    const failed = await loadMembers({ offset: 0 });

    expect(failed.ok && failed.users[0]).toMatchObject({
      id: "u1",
      email: null,
      emailUnavailable: true,
    });
    expect(loggerMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(loggerMock.mock.calls)).not.toContain("ana@example.com");
    expect(JSON.stringify(loggerMock.mock.calls)).not.toContain("luis@example.com");
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
      member: {
        id: "u1",
        email: "ana@example.com",
        role: "super_admin",
        categories: [
          { id: "c1", name: "Alpha" },
          { id: "c2", name: "Beta" },
        ],
      },
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
