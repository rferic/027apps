import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const getInfraMock = vi.fn();
const categoriesHandlerMock = vi.fn();
const categoryHandlerMock = vi.fn();
const usersHandlerMock = vi.fn();
const modulesHandlerMock = vi.fn();

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

vi.mock("@/lib/modules-route-deps", () => ({
  modulesRouteDeps: async () => ({}),
}));

vi.mock("@027apps/core/user-categories/api.js", () => ({
  userCategoriesRoute: () => categoriesHandlerMock,
  userCategoryRoute: () => categoryHandlerMock,
}));

vi.mock("@027apps/core/users/api.js", () => ({
  usersRoute: () => usersHandlerMock,
}));

vi.mock("@027apps/core/modules/api.js", () => ({
  modulesRoute: () => modulesHandlerMock,
}));

import {
  loadCategories,
  loadCategory,
  loadMemberChoices,
  loadModuleChoices,
} from "./panel-categories";

const CATEGORY = {
  id: "c1",
  name: "Familia",
  slug: "familia",
  created_at: "2026-01-01T00:00:00.000Z",
  member_count: 2,
  modules: ["expenses"],
};

const DETAIL = {
  ...CATEGORY,
  members: [{ id: "u1", display_name: "Ana", role: "admin" }],
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function request(mock: ReturnType<typeof vi.fn>, index = 0): Request {
  return mock.mock.calls[index]?.[0] as Request;
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  getInfraMock.mockReset();
  getInfraMock.mockResolvedValue({
    deps: {},
    auth: {},
    settingsDeps: { db: { query: vi.fn() } },
  });
  categoriesHandlerMock.mockReset();
  categoryHandlerMock.mockReset();
  usersHandlerMock.mockReset();
  modulesHandlerMock.mockReset();
});

describe("loadCategories", () => {
  it("calls the categories route in process with the session bearer", async () => {
    categoriesHandlerMock.mockResolvedValue(json({ categories: [CATEGORY] }));

    await expect(loadCategories()).resolves.toEqual({ ok: true, categories: [CATEGORY] });

    const req = request(categoriesHandlerMock);
    expect(req.url).toBe("http://panel.internal/api/v1/user-categories");
    expect(req.method).toBe("GET");
    expect(req.headers.get("authorization")).toBe("Bearer token-123");
    expect(req.headers.get("host")).toBeNull();
  });

  it("returns the public code and request id on a 500", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json(
        { error: { code: "internal", request_id: "req-500" } },
        500,
        { "x-request-id": "req-header" },
      ),
    );

    await expect(loadCategories()).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a malformed category instead of showing a partial list", async () => {
    categoriesHandlerMock.mockResolvedValue(
      json({ categories: [CATEGORY, { id: "c2", name: "Broken" }] }),
    );

    await expect(loadCategories()).resolves.toEqual({ ok: false });
  });

  it("rejects a non-array payload", async () => {
    categoriesHandlerMock.mockResolvedValue(json({ categories: "nope" }));

    await expect(loadCategories()).resolves.toEqual({ ok: false });
  });

  it("redirects to login without an access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadCategories()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(categoriesHandlerMock).not.toHaveBeenCalled();
  });
});

describe("loadCategory", () => {
  it("calls the detail route with the encoded id", async () => {
    categoryHandlerMock.mockResolvedValue(json({ category: DETAIL }));

    await expect(loadCategory("c1")).resolves.toEqual({ ok: true, category: DETAIL });

    const req = request(categoryHandlerMock);
    expect(req.url).toBe("http://panel.internal/api/v1/user-categories/c1");
    expect(categoryHandlerMock.mock.calls[0]?.[1]).toBe("c1");
  });

  it("infers not_found from a bare 404", async () => {
    categoryHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadCategory("missing")).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("keeps the request id of a 500", async () => {
    categoryHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500),
    );

    await expect(loadCategory("c1")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a member without a display name", async () => {
    categoryHandlerMock.mockResolvedValue(
      json({ category: { ...DETAIL, members: [{ id: "u1" }] } }),
    );

    await expect(loadCategory("c1")).resolves.toEqual({ ok: false });
  });
});

describe("loadMemberChoices", () => {
  const USERS = [
    { id: "u1", display_name: "Ana", deactivated_at: null },
    { id: "u2", display_name: "Luis", deactivated_at: "2026-03-01T00:00:00.000Z" },
  ];

  it("lists active members with the filter and the API cap", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: USERS, total: 2, active_total: 1 }));

    await expect(loadMemberChoices({ q: "ana" })).resolves.toEqual({
      ok: true,
      members: [{ id: "u1", displayName: "Ana" }],
      total: 2,
    });

    const req = request(usersHandlerMock);
    expect(req.url).toBe("http://panel.internal/api/v1/users?q=ana&limit=100&offset=0");
  });

  it("rejects a malformed row", async () => {
    usersHandlerMock.mockResolvedValue(
      json({ users: [{ id: "u1" }], total: 1, active_total: 1 }),
    );

    await expect(loadMemberChoices({})).resolves.toEqual({ ok: false });
  });
});

describe("loadModuleChoices", () => {
  it("lists installed modules by key and name", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({
        modules: [
          { key: "expenses", name: "Expenses", version: "1.0.0", state: "active", is_public: false },
        ],
      }),
    );

    await expect(loadModuleChoices()).resolves.toEqual({
      ok: true,
      modules: [{ key: "expenses", name: "Expenses" }],
    });
  });

  it("keeps the failure code of the module catalogue", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({ error: { code: "insufficient_scope", request_id: "req-403" } }, 403),
    );

    await expect(loadModuleChoices()).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-403",
    });
  });
});
