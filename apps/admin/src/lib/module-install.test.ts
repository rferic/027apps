import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const getSessionMock = vi.fn();
const depsMock = vi.fn();
const installHandlerMock = vi.fn();

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
  installModuleRoute: () => installHandlerMock,
}));

import { installModule } from "./module-install";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  redirectMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  depsMock.mockReset();
  depsMock.mockResolvedValue({});
  installHandlerMock.mockReset();
});

describe("installModule", () => {
  it("POSTs the install route in process with the session bearer", async () => {
    installHandlerMock.mockResolvedValue(json({ module: { key: "debug" } }, 201));

    await expect(installModule("debug")).resolves.toEqual({ ok: true });

    const request = installHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules/debug/install");
    expect(request.method).toBe("POST");
    expect(request.headers.get("authorization")).toBe("Bearer token-123");
    // The origin is fixed in process: no forged host can move the call.
    expect(request.headers.get("host")).toBeNull();
    expect(installHandlerMock.mock.calls[0]?.[1]).toBe("debug");
  });

  it("escapes the key in the path", async () => {
    installHandlerMock.mockResolvedValue(json({ module: {} }, 201));

    await installModule("a/b");

    const request = installHandlerMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://panel.internal/api/v1/modules/a%2Fb/install");
  });

  it("maps 409 to an already-installed failure with the request id", async () => {
    installHandlerMock.mockResolvedValue(
      json(
        { error: { code: "conflict", request_id: "req-409" } },
        409,
        { "x-request-id": "req-409" },
      ),
    );

    await expect(installModule("debug")).resolves.toEqual({
      ok: false,
      reason: "already_installed",
      requestId: "req-409",
    });
  });

  it("maps 400 to an invalid manifest failure", async () => {
    installHandlerMock.mockResolvedValue(
      json({ error: { code: "validation_failed", request_id: "req-400" } }, 400),
    );

    await expect(installModule("debug")).resolves.toEqual({
      ok: false,
      reason: "invalid_manifest",
      requestId: "req-400",
    });
  });

  it("maps 403 to a forbidden failure", async () => {
    installHandlerMock.mockResolvedValue(
      json({ error: { code: "insufficient_scope", request_id: "req-403" } }, 403),
    );

    await expect(installModule("debug")).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      requestId: "req-403",
    });
  });

  it("keeps an unknown status generic and still reads the header request id", async () => {
    installHandlerMock.mockResolvedValue(
      json({ error: { code: "internal" } }, 500, { "x-request-id": "req-500" }),
    );

    await expect(installModule("debug")).resolves.toEqual({
      ok: false,
      reason: "failed",
      requestId: "req-500",
    });
  });

  it("survives a route that throws without leaking the failure", async () => {
    installHandlerMock.mockRejectedValue(new Error("database down"));

    await expect(installModule("debug")).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("redirects to the login page when the session has no access token", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    await expect(installModule("debug")).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(installHandlerMock).not.toHaveBeenCalled();
  });
});
