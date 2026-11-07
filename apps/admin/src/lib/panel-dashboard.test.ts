import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const withTransactionClientMock = vi.fn();
const computeHealthMock = vi.fn();
const readInstanceStateMock = vi.fn();
const healthRouteMock = vi.fn();
const instanceRouteMock = vi.fn();
const loggerMock = vi.fn();

const handlers = {
  users: vi.fn(),
  categories: vi.fn(),
  invitations: vi.fn(),
  modules: vi.fn(),
};

const authenticatedRoutes = [
  { route: "users", handler: handlers.users, invalid: { users: "not-an-array" } },
  { route: "user categories", handler: handlers.categories, invalid: { categories: "not-an-array" } },
  { route: "invitations", handler: handlers.invitations, invalid: { invitations: "not-an-array" } },
  { route: "modules", handler: handlers.modules, invalid: { modules: "not-an-array" } },
] as const;

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
  withTransactionClient: (...args: Parameters<typeof withTransactionClientMock>) =>
    withTransactionClientMock(...args),
}));

vi.mock("@/lib/instance-state", () => ({
  readInstanceState: () => readInstanceStateMock(),
}));

vi.mock("@/lib/invitations-route-deps", () => ({
  invitationsRouteDeps: async () => ({ door: {}, auth: {}, invitations: {} }),
}));

vi.mock("@/lib/modules-route-deps", () => ({
  modulesRouteDeps: async () => ({
    door: {},
    auth: {},
    modules: {},
    manifest: async () => null,
  }),
}));

vi.mock("@027apps/core/settings/service.js", () => ({
  computeHealth: (...args: unknown[]) => computeHealthMock(...args),
}));

// Kept only as a tripwire: the dashboard must never reach these public routes.
vi.mock("@027apps/core/instance/api.js", () => ({
  healthRoute: (...args: unknown[]) => healthRouteMock(...args),
  instanceRoute: (...args: unknown[]) => instanceRouteMock(...args),
}));

vi.mock("@027apps/core/users/api.js", () => ({
  usersRoute: () => handlers.users,
}));

vi.mock("@027apps/core/user-categories/api.js", () => ({
  userCategoriesRoute: () => handlers.categories,
}));

vi.mock("@027apps/core/invitations/api.js", () => ({
  invitationsRoute: () => handlers.invitations,
}));

vi.mock("@027apps/core/modules/api.js", () => ({
  modulesRoute: () => handlers.modules,
}));

import { loadPanelDashboard } from "./panel-dashboard";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

const MODULES = [
  { key: "expenses", name: "Expenses", version: "1.0.0", state: "active", is_public: true },
  { key: "notes", name: "Notes", version: "1.0.0", state: "active", is_public: false },
  { key: "photos", name: "Photos", version: "0.1.0", state: "disabled", is_public: false },
];

const USERS = [
  { id: "u1", display_name: "Ana", role: "super_admin", deactivated_at: null },
  { id: "u2", display_name: "Luis", role: "admin", deactivated_at: null },
  { id: "u3", display_name: "Marta", role: "user", deactivated_at: "2026-01-01T00:00:00.000Z" },
];

function resolveDefaultReads(): void {
  computeHealthMock.mockResolvedValue({ status: "ok", degradedReasons: [] });
  readInstanceStateMock.mockResolvedValue({ installed: true, setupIncomplete: false });
  handlers.users.mockResolvedValue(json({ users: USERS, total: 3, active_total: 2 }));
  handlers.categories.mockResolvedValue(json({ categories: [{ id: "c1" }, { id: "c2" }], total: 2 }));
  handlers.invitations.mockResolvedValue(
    json({
      invitations: [{ status: "pending" }, { status: "used" }, { status: "expired" }],
      total: 3,
    }),
  );
  handlers.modules.mockResolvedValue(json({ modules: MODULES, total: 3 }));
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  getInfraMock.mockReset();
  loggerMock.mockReset();
  getInfraMock.mockResolvedValue({
    deps: { rateLimitStorage: {}, logger: loggerMock },
    auth: async () => ({ kind: "anon" }),
    settingsDeps: { db: { query: vi.fn() }, encryption: null },
  });
  withTransactionClientMock.mockReset();
  computeHealthMock.mockReset();
  readInstanceStateMock.mockReset();
  healthRouteMock.mockReset();
  instanceRouteMock.mockReset();
  for (const handler of Object.values(handlers)) handler.mockReset();
  resolveDefaultReads();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadPanelDashboard", () => {
  it("starts the two service reads and four route calls in parallel", async () => {
    let started = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    computeHealthMock.mockImplementation(async () => {
      started += 1;
      await gate;
      return { status: "ok", degradedReasons: [] };
    });
    readInstanceStateMock.mockImplementation(async () => {
      started += 1;
      await gate;
      return { installed: true, setupIncomplete: false };
    });
    handlers.users.mockImplementation(async () => {
      started += 1;
      await gate;
      return json({ users: USERS, total: USERS.length, active_total: 2 });
    });
    handlers.categories.mockImplementation(async () => {
      started += 1;
      await gate;
      return json({ categories: [], total: 0 });
    });
    handlers.invitations.mockImplementation(async () => {
      started += 1;
      await gate;
      return json({ invitations: [], total: 0 });
    });
    handlers.modules.mockImplementation(async () => {
      started += 1;
      await gate;
      return json({ modules: MODULES, total: 3 });
    });

    const pending = loadPanelDashboard();

    await vi.waitFor(() => expect(started).toBe(6));
    release();
    await pending;

    expect(computeHealthMock).toHaveBeenCalledTimes(1);
    expect(readInstanceStateMock).toHaveBeenCalledTimes(1);
    for (const handler of Object.values(handlers)) {
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  it("returns the real health, setup state, KPIs and modules", async () => {
    const result = await loadPanelDashboard();

    expect(result).toEqual({
      ok: true,
      health: { status: "ok", reasons: [] },
      setupIncomplete: false,
      kpis: {
        members: 3,
        activeMembers: 2,
        pendingInvitations: 1,
        activeModules: 2,
        totalModules: 3,
        categories: 2,
      },
      modules: [
        { key: "expenses", name: "Expenses", state: "active", isPublic: true },
        { key: "notes", name: "Notes", state: "active", isPublic: false },
        { key: "photos", name: "Photos", state: "disabled", isPublic: false },
      ],
    });

    expect(computeHealthMock).toHaveBeenCalledWith(
      expect.objectContaining({ encryption: null }),
    );

    const usersRequest = handlers.users.mock.calls[0]?.[0] as Request;
    expect(usersRequest.url).toBe("http://panel.internal/api/v1/users?limit=100");
    expect(usersRequest.headers.get("authorization")).toBe("Bearer token-123");
  });

  it("keeps a degraded health response as success with its reasons", async () => {
    computeHealthMock.mockResolvedValue({
      status: "degraded",
      degradedReasons: ["database_unreachable"],
    });

    const result = await loadPanelDashboard();

    expect(result).toMatchObject({
      ok: true,
      health: { status: "degraded", reasons: ["database_unreachable"] },
    });
  });

  it("treats a missing super_admin as an incomplete setup", async () => {
    readInstanceStateMock.mockResolvedValue({ installed: false, setupIncomplete: false });

    await expect(loadPanelDashboard()).resolves.toMatchObject({
      ok: true,
      setupIncomplete: true,
    });
  });

  it("uses the instance-wide active_total even when the page is capped", async () => {
    handlers.users.mockResolvedValue(
      json({ users: USERS.slice(0, 1), total: 137, active_total: 121 }),
    );

    await expect(loadPanelDashboard()).resolves.toMatchObject({
      ok: true,
      kpis: { members: 137, activeMembers: 121 },
    });
  });

  it.each(authenticatedRoutes)(
    "fails the whole dashboard with the request id when $route returns 500",
    async ({ handler }) => {
      handler.mockResolvedValue(
        json(
          { error: { code: "internal", message: "Internal server error", request_id: "req-500" } },
          500,
          { "x-request-id": "req-header" },
        ),
      );

      await expect(loadPanelDashboard()).resolves.toEqual({
        ok: false,
        code: "internal",
        requestId: "req-500",
      });
    },
  );

  it.each(authenticatedRoutes)(
    "keeps the header request id when $route returns an invalid 2xx shape",
    async ({ handler, invalid }) => {
      handler.mockResolvedValue(json(invalid, 200, { "x-request-id": "req-shape" }));

      await expect(loadPanelDashboard()).resolves.toEqual({
        ok: false,
        requestId: "req-shape",
      });
    },
  );

  it("rejects a non-numeric total or active_total instead of substituting the page size", async () => {
    handlers.users.mockResolvedValue(json({ users: [], total: "3", active_total: 0 }));
    await expect(loadPanelDashboard()).resolves.toEqual({ ok: false });

    resolveDefaultReads();
    handlers.users.mockResolvedValue(json({ users: [], total: 0, active_total: null }));
    await expect(loadPanelDashboard()).resolves.toEqual({ ok: false });
  });

  it("prefers the invalid response that actually carries a request id", async () => {
    handlers.users.mockResolvedValue(json({ users: "not-an-array" }));
    handlers.categories.mockResolvedValue(
      json({ categories: "not-an-array" }, 200, { "x-request-id": "req-cat" }),
    );

    await expect(loadPanelDashboard()).resolves.toEqual({
      ok: false,
      requestId: "req-cat",
    });
  });

  it.each([
    {
      service: "computeHealth",
      fail: () => computeHealthMock.mockRejectedValue(new Error("database unreachable")),
    },
    {
      service: "readInstanceState",
      fail: () => readInstanceStateMock.mockRejectedValue(new Error("database unreachable")),
    },
  ])("fails and logs without PII when $service throws", async ({ fail }) => {
    fail();

    await expect(loadPanelDashboard()).resolves.toEqual({ ok: false });

    expect(loggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", requestId: "panel-dashboard" }),
    );
    expect(JSON.stringify(loggerMock.mock.calls)).not.toContain("database unreachable");
  });

  it("never invokes the public health or instance routes", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await loadPanelDashboard();

    expect(healthRouteMock).not.toHaveBeenCalled();
    expect(instanceRouteMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redirects to the login page when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadPanelDashboard()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(computeHealthMock).not.toHaveBeenCalled();
    expect(readInstanceStateMock).not.toHaveBeenCalled();
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
