import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const depsMock = vi.fn();
const handlerMock = vi.fn();

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

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  depsMock.mockReset();
  depsMock.mockResolvedValue({});
  handlerMock.mockReset();
});

describe("loadApiKeys", () => {
  it("calls the API keys route in process with the session bearer", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY] }));

    const result = await loadApiKeys();

    expect(result).toEqual({ ok: true, apiKeys: [KEY] });
    const request = handlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/api-keys");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(request.headers.get("host")).toBeNull();
  });

  it("keeps a null role_cap and null dates distinguishable from a malformed row", async () => {
    handlerMock.mockResolvedValue(json({ api_keys: [KEY] }));

    const result = await loadApiKeys();

    expect(result.ok && result.apiKeys[0]).toMatchObject({
      role_cap: null,
      revoked_at: null,
      last_used_at: "2026-11-01T10:00:00.000Z",
    });
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
