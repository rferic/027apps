import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const depsMock = vi.fn();
const detailHandlerMock = vi.fn();
const listHandlerMock = vi.fn();
const settingsHandlerMock = vi.fn();
const grantsHandlerMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@/lib/modules-route-deps", () => ({
  modulesRouteDeps: () => depsMock(),
}));

vi.mock("@027apps/core/modules/api.js", () => ({
  moduleRoute: () => detailHandlerMock,
  modulesRoute: () => listHandlerMock,
  moduleSettingsRoute: () => settingsHandlerMock,
  moduleGrantsRoute: () => grantsHandlerMock,
}));

import { loadModuleDetail, loadModuleGrants, loadModules, loadModuleSettings } from "./panel-modules";

const MODULE = {
  key: "inventory",
  name: "Inventory",
  version: "1.0.0",
  state: "active",
  is_public: false,
  mcp_exposed: "read",
  manifest_digest: "a".repeat(64),
  installed_at: "2026-10-01T10:00:00.000Z",
  updated_at: "2026-10-02T10:00:00.000Z",
};

const SETTING = {
  category_key: "inventory",
  key: "inventory.low_stock_threshold",
  label: "Low stock threshold",
  help: null,
  value: 5,
  is_secret: false,
  configured: true,
  is_public: false,
  mcp_access: "none",
  sort_order: 1,
  updated_at: "2026-10-02T10:00:00.000Z",
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  depsMock.mockReset();
  depsMock.mockResolvedValue({});
  detailHandlerMock.mockReset();
  listHandlerMock.mockReset();
  settingsHandlerMock.mockReset();
  grantsHandlerMock.mockReset();
});

describe("loadModuleDetail", () => {
  it("reads the module in process with the session bearer", async () => {
    detailHandlerMock.mockResolvedValue(json({ module: MODULE }));

    await expect(loadModuleDetail("inventory")).resolves.toEqual({ ok: true, module: MODULE });

    const request = detailHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules/inventory");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("host")).toBeNull();
    expect(detailHandlerMock.mock.calls[0]?.[1]).toBe("inventory");
  });

  it("keeps only the contract fields of the module", async () => {
    detailHandlerMock.mockResolvedValue(
      json({ module: { ...MODULE, settings_public: [], installed_by: "u1" } }),
    );

    await expect(loadModuleDetail("inventory")).resolves.toEqual({ ok: true, module: MODULE });
  });

  it("infers not_found from a bare 404", async () => {
    detailHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadModuleDetail("missing")).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("keeps the public code and request id on a 500", async () => {
    detailHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500, {
        "x-request-id": "req-header",
      }),
    );

    await expect(loadModuleDetail("inventory")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a malformed module instead of showing a partial record", async () => {
    detailHandlerMock.mockResolvedValue(
      json({ module: { key: "inventory", name: "Inventory" } }, 200, {
        "x-request-id": "req-shape",
      }),
    );

    await expect(loadModuleDetail("inventory")).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });

  it("rejects an unknown state or MCP exposure", async () => {
    detailHandlerMock.mockResolvedValue(json({ module: { ...MODULE, state: "broken" } }));
    await expect(loadModuleDetail("inventory")).resolves.toEqual({ ok: false });

    detailHandlerMock.mockResolvedValue(json({ module: { ...MODULE, mcp_exposed: "all" } }));
    await expect(loadModuleDetail("inventory")).resolves.toEqual({ ok: false });
  });

  it("redirects to login when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadModuleDetail("inventory")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(detailHandlerMock).not.toHaveBeenCalled();
  });
});

describe("loadModuleSettings", () => {
  it("reads the settings in process and keeps secrets without their value", async () => {
    const secret = {
      ...SETTING,
      key: "inventory.api_token",
      label: "API token",
      value: null,
      is_secret: true,
      configured: true,
    };
    settingsHandlerMock.mockResolvedValue(json({ settings: [SETTING, secret] }));

    await expect(loadModuleSettings("inventory")).resolves.toEqual({
      ok: true,
      settings: [SETTING, secret],
    });

    const request = settingsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules/inventory/settings");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(settingsHandlerMock.mock.calls[0]?.[1]).toBe("inventory");
  });

  it("accepts an empty list", async () => {
    settingsHandlerMock.mockResolvedValue(json({ settings: [] }));

    await expect(loadModuleSettings("inventory")).resolves.toEqual({ ok: true, settings: [] });
  });

  it("keeps the 403 code when the role lacks the scope", async () => {
    settingsHandlerMock.mockResolvedValue(
      json({ error: { code: "insufficient_scope", request_id: "req-403" } }, 403),
    );

    await expect(loadModuleSettings("inventory")).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-403",
    });
  });

  it("rejects a malformed setting instead of showing a partial table", async () => {
    settingsHandlerMock.mockResolvedValue(
      json({ settings: [SETTING, { key: "inventory.broken" }] }, 200, {
        "x-request-id": "req-shape",
      }),
    );

    await expect(loadModuleSettings("inventory")).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });

  it("rejects a body whose settings field is not a list", async () => {
    settingsHandlerMock.mockResolvedValue(json({ settings: "nope" }));

    await expect(loadModuleSettings("inventory")).resolves.toEqual({ ok: false });
  });
});

describe("loadModuleGrants", () => {
  it("reads the grants in process", async () => {
    grantsHandlerMock.mockResolvedValue(
      json({
        users: [{ id: "u1", display_name: "Sara" }],
        categories: [{ id: "c1", name: "Family" }],
      }),
    );

    await expect(loadModuleGrants("inventory")).resolves.toEqual({
      ok: true,
      grants: {
        users: [{ id: "u1", display_name: "Sara" }],
        categories: [{ id: "c1", name: "Family" }],
      },
    });

    const request = grantsHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules/inventory/grants");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(grantsHandlerMock.mock.calls[0]?.[1]).toBe("inventory");
  });

  it("keeps empty arrays as empty grants", async () => {
    grantsHandlerMock.mockResolvedValue(json({ users: [], categories: [] }));

    await expect(loadModuleGrants("inventory")).resolves.toEqual({
      ok: true,
      grants: { users: [], categories: [] },
    });
  });

  it("rejects null aggregates", async () => {
    grantsHandlerMock.mockResolvedValue(json({ users: null, categories: [] }));

    await expect(loadModuleGrants("inventory")).resolves.toEqual({ ok: false });
  });

  it("rejects a grant entry without its identity", async () => {
    grantsHandlerMock.mockResolvedValue(
      json({ users: [{ display_name: "Sara" }], categories: [] }, 200, {
        "x-request-id": "req-shape",
      }),
    );

    await expect(loadModuleGrants("inventory")).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });

  it("infers not_found from a bare 404", async () => {
    grantsHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadModuleGrants("missing")).resolves.toEqual({ ok: false, code: "not_found" });
  });
});

describe("loadModules", () => {
  it("reads one page in process with the session bearer", async () => {
    listHandlerMock.mockResolvedValue(json({ modules: [MODULE], total: 1 }));

    await expect(loadModules({ offset: 20, limit: 100 })).resolves.toEqual({
      ok: true,
      modules: [MODULE],
      total: 1,
    });

    const request = listHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules?limit=100&offset=20");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
  });

  it("defaults the page size and rejects a malformed row", async () => {
    listHandlerMock.mockResolvedValue(
      json({ modules: [{ key: "broken" }], total: 1 }, 200, { "x-request-id": "req-list" }),
    );

    await expect(loadModules({ offset: 0 })).resolves.toEqual({
      ok: false,
      requestId: "req-list",
    });

    const request = listHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules?limit=20&offset=0");
  });
});
