import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const depsMock = vi.fn();
const handlerMock = vi.fn();
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

vi.mock("@027apps/core/api-keys/api.js", () => ({
  apiKeysRoute: () => handlerMock,
}));

import { loadApiKeys } from "./panel-keys";

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
});

describe("loadApiKeys", () => {
  it("calls the API keys route in process with the session bearer", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY] }));

    const result = await loadApiKeys();

    expect(result).toEqual({ ok: true, apiKeys: [ROW] });
    const request = handlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/api-keys");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("host")).toBeNull();
  });

  it("resolves delegated owners in one profile query and labels service keys as the instance", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY, SERVICE_KEY] }));

    const result = await loadApiKeys();

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
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[1]).toEqual([["u1"]]);
  });

  it("keeps a null role_cap and null dates distinguishable from a malformed row", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY] }));

    const result = await loadApiKeys();

    expect(result.ok && result.apiKeys[0]).toMatchObject({
      roleCap: null,
      expiresAt: null,
      revoked_at: null,
      last_used_at: "2026-11-01T10:00:00.000Z",
    });
  });

  it("falls back to the user id when the profile read fails", async () => {
    queryMock.mockRejectedValue(new Error("db down"));
    handlerMock.mockResolvedValue(json({ api_keys: [KEY] }));

    const result = await loadApiKeys();

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

    await expect(loadApiKeys()).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("infers not_found from a bare 404", async () => {
    handlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadApiKeys()).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("rejects a malformed row instead of showing a partial table", async () => {
    handlerMock.mockResolvedValue(
      json({ api_keys: [KEY, { id: "broken", name: "Broken", kind: "delegated" }] }),
    );

    await expect(loadApiKeys()).resolves.toEqual({ ok: false });
  });

  it("rejects an unknown kind", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [{ ...KEY, kind: "root" }] }));

    await expect(loadApiKeys()).resolves.toEqual({ ok: false });
  });

  it("keeps the header request id when a 2xx body has an invalid shape", async () => {
    handlerMock.mockResolvedValue(
      json({ api_keys: "not-an-array" }, 200, { "x-request-id": "req-shape" }),
    );

    await expect(loadApiKeys()).resolves.toEqual({ ok: false, requestId: "req-shape" });
  });

  it("redirects to login when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(loadApiKeys()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(handlerMock).not.toHaveBeenCalled();
  });
});
