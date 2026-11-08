import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const depsMock = vi.fn();
const handlerMock = vi.fn();
const detailHandlerMock = vi.fn();
const updateHandlerMock = vi.fn();
const usersHandlerMock = vi.fn();
const queryMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getSession: () => getSessionMock() },
  }),
}));

vi.mock("@/lib/api-keys-route-deps", () => ({
  apiKeysRouteDeps: () => depsMock(),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({
    deps: {},
    auth: async () => ({ kind: "anon" }),
    settingsDeps: { db: { query: queryMock } },
  }),
  withTransactionClient: async <T,>(fn: (db: unknown) => Promise<T>) =>
    fn({ query: queryMock }),
}));

vi.mock("@027apps/core/api-keys/api.js", () => ({
  apiKeysRoute: () => handlerMock,
  apiKeyRoute: () => detailHandlerMock,
  updateApiKeyRoute: () => updateHandlerMock,
}));

vi.mock("@027apps/core/users/api.js", () => ({
  usersRoute: () => usersHandlerMock,
}));

import {
  loadActiveDelegatedCounts,
  loadApiKeyOwners,
  loadApiKeys,
  loadKey,
  updateKey,
} from "./panel-keys";

const KEY = {
  id: "k1",
  kind: "delegated",
  name: "Zapier",
  scopes: ["users:read"],
  user_id: "u1",
  role_cap: null,
  prefix: "027_usr_",
  expires_at: null,
  revoked_at: null,
  last_used_at: "2026-11-01T10:00:00.000Z",
  created_at: "2026-10-01T10:00:00.000Z",
};

const SERVICE_KEY = {
  ...KEY,
  id: "k2",
  kind: "service",
  name: "Backup",
  user_id: null,
  role_cap: "super_admin",
  prefix: "027_svc_",
};

/** Panel view: the Core row with its dates exposed and the owner resolved. */
const ROW = {
  id: KEY.id,
  kind: KEY.kind,
  name: KEY.name,
  scopes: KEY.scopes,
  user_id: KEY.user_id,
  owner: "Sara",
  roleCap: null,
  prefix: KEY.prefix,
  expiresAt: null,
  revoked_at: KEY.revoked_at,
  last_used_at: KEY.last_used_at,
  created_at: KEY.created_at,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  depsMock.mockReset();
  depsMock.mockResolvedValue({ apiKeys: { db: { query: queryMock } } });
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rows: [{ id: "u1", display_name: "Sara" }] });
  handlerMock.mockReset();
  detailHandlerMock.mockReset();
  updateHandlerMock.mockReset();
  usersHandlerMock.mockReset();
});

describe("loadApiKeyOwners", () => {
  it("loads active users, capped at 100, and falls back to the id as the name", async () => {
    usersHandlerMock.mockResolvedValue(
      json({
        users: [
          { id: "u1", display_name: "Sara" },
          { id: "u2", display_name: "" },
        ],
        total: 2,
        active_total: 2,
      }),
    );

    await expect(loadApiKeyOwners()).resolves.toEqual({
      ok: true,
      owners: [
        { id: "u1", name: "Sara" },
        { id: "u2", name: "u2" },
      ],
    });

    const request = usersHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users?state=active&limit=100&offset=0");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
  });

  it("propagates the public error code", async () => {
    usersHandlerMock.mockResolvedValue(
      json({ error: { code: "insufficient_scope", request_id: "req-1" } }, 403),
    );

    await expect(loadApiKeyOwners()).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-1",
    });
  });

  it("rejects a malformed user row", async () => {
    usersHandlerMock.mockResolvedValue(json({ users: [{ display_name: "No id" }], total: 1 }));

    await expect(loadApiKeyOwners()).resolves.toEqual({ ok: false });
  });
});

describe("loadActiveDelegatedCounts", () => {
  it("counts active delegated keys per owner", async () => {
    queryMock.mockResolvedValue({
      rows: [
        { user_id: "u1", n: 2 },
        { user_id: "u2", n: 5 },
      ],
    });

    await expect(loadActiveDelegatedCounts()).resolves.toEqual({ u1: 2, u2: 5 });
    expect(String(queryMock.mock.calls[0]?.[0])).toContain("kind = 'delegated'");
  });

  it("degrades to no counts instead of blocking the page", async () => {
    queryMock.mockRejectedValue(new Error("db down"));

    await expect(loadActiveDelegatedCounts()).resolves.toEqual({});
  });
});

describe("loadKey", () => {
  it("reads one key in process with the session bearer and resolves its owner", async () => {
    detailHandlerMock.mockResolvedValue(json({ api_key: KEY }));

    await expect(loadKey("k1")).resolves.toEqual({ ok: true, apiKey: ROW });

    const request = detailHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/api-keys/k1");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(detailHandlerMock.mock.calls[0]?.[1]).toBe("k1");
    expect(queryMock.mock.calls[0]?.[1]).toEqual([["u1"]]);
  });

  it("labels a service key as the instance without reading profiles", async () => {
    detailHandlerMock.mockResolvedValue(json({ api_key: SERVICE_KEY }));

    const result = await loadKey("k2");

    expect(result.ok && result.apiKey.owner).toBe("Instance");
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("infers not_found from a bare 404", async () => {
    detailHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadKey("missing")).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("keeps the public code and request id on a 500", async () => {
    detailHandlerMock.mockResolvedValue(
      json(
        { error: { code: "internal", request_id: "req-500" } },
        500,
        { "x-request-id": "req-header" },
      ),
    );

    await expect(loadKey("k1")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("rejects a malformed detail instead of showing a partial record", async () => {
    detailHandlerMock.mockResolvedValue(
      json({ api_key: { id: "k1", name: "Zapier", kind: "delegated" } }, 200, {
        "x-request-id": "req-shape",
      }),
    );

    await expect(loadKey("k1")).resolves.toEqual({ ok: false, requestId: "req-shape" });
  });
});

describe("updateKey", () => {
  it("patches the key in process with the session bearer and the given patch", async () => {
    updateHandlerMock.mockResolvedValue(json({ api_key: KEY }));

    await expect(
      updateKey("k1", { name: "Renamed", scopes: ["users:read"] }),
    ).resolves.toEqual({ ok: true, apiKey: ROW });

    const request = updateHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/api-keys/k1");
    expect(request.method).toBe("PATCH");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("content-type")).toBe("application/json");
    await expect(request.json()).resolves.toEqual({ name: "Renamed", scopes: ["users:read"] });
    expect(updateHandlerMock.mock.calls[0]?.[1]).toBe("k1");
  });

  it("keeps the revoked detail code so the page can explain the conflict", async () => {
    updateHandlerMock.mockResolvedValue(
      json(
        {
          error: {
            code: "conflict",
            request_id: "req-409",
            details: { code: "revoked" },
          },
        },
        409,
      ),
    );

    await expect(updateKey("k1", { name: "Renamed" })).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-409",
      details: { code: "revoked" },
    });
  });

  it("infers not_found from a bare 404", async () => {
    updateHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(updateKey("missing", { name: "Renamed" })).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("rejects a malformed updated key instead of showing a partial record", async () => {
    updateHandlerMock.mockResolvedValue(
      json({ api_key: { id: "k1", name: "Renamed" } }, 200, { "x-request-id": "req-shape" }),
    );

    await expect(updateKey("k1", { name: "Renamed" })).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });
});

describe("loadApiKeys", () => {
  it("calls the API keys route in process with the session bearer", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY], total: 1 }));

    const result = await loadApiKeys({ offset: 0 });

    expect(result).toEqual({ ok: true, apiKeys: [ROW], total: 1 });
    const request = handlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/api-keys?limit=20&offset=0");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("host")).toBeNull();
  });

  it("forwards the kind and owner filters and omits kind=all", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY], total: 1 }));

    await loadApiKeys({ offset: 20, kind: "delegated", user: "u1" });
    const filtered = handlerMock.mock.calls[0]?.[0] as Request;
    expect(filtered.url).toBe(
      "http://panel.internal/api/v1/api-keys?limit=20&offset=20&kind=delegated&user=u1",
    );

    handlerMock.mockClear();
    await loadApiKeys({ offset: 0, kind: "all" });
    const unfiltered = handlerMock.mock.calls[0]?.[0] as Request;
    expect(unfiltered.url).toBe("http://panel.internal/api/v1/api-keys?limit=20&offset=0");
  });

  it("resolves delegated owners in one profile query and labels service keys as the instance", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY, SERVICE_KEY], total: 1 }));

    const result = await loadApiKeys({ offset: 0 });

    expect(result).toEqual({
      ok: true,
      apiKeys: [
        ROW,
        {
          ...ROW,
          id: "k2",
          kind: "service",
          name: "Backup",
          user_id: null,
          owner: "Instance",
          roleCap: "super_admin",
          prefix: "027_svc_",
        },
      ],
      total: 1,
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[1]).toEqual([["u1"]]);
  });

  it("keeps a null role_cap and null dates distinguishable from a malformed row", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY], total: 1 }));

    const result = await loadApiKeys({ offset: 0 });

    expect(result.ok && result.apiKeys[0]).toMatchObject({
      roleCap: null,
      expiresAt: null,
      revoked_at: null,
      last_used_at: "2026-11-01T10:00:00.000Z",
    });
  });

  it("falls back to the user id when the profile read fails", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    handlerMock.mockResolvedValue(json({ api_keys: [KEY], total: 1 }));

    const result = await loadApiKeys({ offset: 0 });

    expect(result.ok && result.apiKeys[0]?.owner).toBe("u1");
  });

  it("returns the public code and request id on a 500", async () => {
    handlerMock.mockResolvedValue(
      json(
        { error: { code: "internal", request_id: "req-500" } },
        500,
        { "x-request-id": "req-header" },
      ),
    );

    await expect(loadApiKeys({ offset: 0 })).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("infers not_found from a bare 404", async () => {
    handlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadApiKeys({ offset: 0 })).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("rejects a malformed row instead of showing a partial table", async () => {
    handlerMock.mockResolvedValue(
      json({ api_keys: [KEY, { id: "broken", name: "Broken", kind: "delegated" }], total: 1 }),
    );

    await expect(loadApiKeys({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("rejects an unknown kind", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [{ ...KEY, kind: "root" }], total: 1 }));

    await expect(loadApiKeys({ offset: 0 })).resolves.toEqual({ ok: false });
  });

  it("keeps the header request id when a 2xx body has an invalid shape", async () => {
    handlerMock.mockResolvedValue(
      json({ api_keys: "not-an-array" }, 200, { "x-request-id": "req-shape" }),
    );

    await expect(loadApiKeys({ offset: 0 })).resolves.toEqual({ ok: false, requestId: "req-shape" });
  });

  it("redirects to login when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadApiKeys({ offset: 0 })).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(handlerMock).not.toHaveBeenCalled();
  });
});
