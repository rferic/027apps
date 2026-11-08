import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
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
  getInfra: async () => ({
    deps: {},
    auth: async () => ({ kind: "anon" }),
    settingsDeps: { db: { query: vi.fn() } },
  }),
  withTransactionClient: async <T,>(fn: (db: unknown) => Promise<T>) =>
    fn({ query: vi.fn() }),
}));

vi.mock("@027apps/core/users/api.js", () => ({
  userModulesRoute: () => modulesHandlerMock,
}));

import { loadUserModules } from "./panel-user-modules";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  modulesHandlerMock.mockReset();
});

describe("loadUserModules", () => {
  it("reads the owner's modules in process with the session bearer", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({
        modules: [
          { key: "recetas", name: "Recetas" },
          { key: "fotos", name: "Fotos" },
        ],
      }),
    );

    await expect(loadUserModules("u1")).resolves.toEqual({
      ok: true,
      modules: [
        { key: "recetas", name: "Recetas" },
        { key: "fotos", name: "Fotos" },
      ],
    });

    const request = modulesHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/users/u1/modules");
    expect(request.method).toBe("GET");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    expect(modulesHandlerMock.mock.calls[0]?.[1]).toBe("u1");
  });

  it("keeps the public code and request id on a 500", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({ error: { code: "internal", request_id: "req-500" } }, 500, {
        "x-request-id": "req-header",
      }),
    );

    await expect(loadUserModules("u1")).resolves.toEqual({
      ok: false,
      code: "internal",
      requestId: "req-500",
    });
  });

  it("propagates a 403 instead of hiding the owner's modules", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({ error: { code: "insufficient_scope", request_id: "req-403" } }, 403),
    );

    await expect(loadUserModules("u1")).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-403",
    });
  });

  it("infers not_found from a bare 404", async () => {
    modulesHandlerMock.mockResolvedValue(new Response("", { status: 404 }));

    await expect(loadUserModules("missing")).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("degrades to an empty list only on a transient transport failure", async () => {
    modulesHandlerMock.mockRejectedValue(new Error("network down"));

    await expect(loadUserModules("u1")).resolves.toEqual({ ok: true, modules: [] });
  });

  it("rejects a malformed body instead of inventing modules", async () => {
    modulesHandlerMock.mockResolvedValue(
      json({ modules: [{ key: "recetas" }] }, 200, { "x-request-id": "req-shape" }),
    );

    await expect(loadUserModules("u1")).resolves.toEqual({
      ok: false,
      requestId: "req-shape",
    });
  });
});
