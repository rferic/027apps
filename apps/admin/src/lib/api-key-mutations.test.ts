import { describe, expect, it, vi } from "vitest";
import { createApiKey, revokeApiKey, type CreateApiKeyInput } from "./api-key-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

const INPUT: CreateApiKeyInput = {
  kind: "service",
  name: "Backup",
  scopes: ["users:read", "settings:read"],
  role_cap: "admin",
};

describe("createApiKey", () => {
  it("POSTs the contract fields and returns the one-time secret", async () => {
    const fetcher = vi.fn(async () =>
      json({ api_key: { id: "k1" }, secret: "027_svc_abc" }, 201),
    );

    await expect(createApiKey(INPUT, fetcher)).resolves.toEqual({ ok: true, secret: "027_svc_abc" });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/api-keys");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual(INPUT);
  });

  it("never invents a secret when the API does not return one", async () => {
    const fetcher = vi.fn(async () => json({ api_key: { id: "k1" } }, 201));

    await expect(createApiKey(INPUT, fetcher)).resolves.toEqual({ ok: true });
  });

  it("keeps the failing catalog key of a validation failure", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: { key: "localization.timezone", formErrors: ["bad zone"], fieldErrors: {} },
          },
        },
        400,
      ),
    );

    await expect(createApiKey(INPUT, fetcher)).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: { key: "localization.timezone", formErrors: ["bad zone"], fieldErrors: {} },
    });
  });

  it("does not treat a 201 HTML page as success", async () => {
    const fetcher = vi.fn(async () => new Response("<html></html>", { status: 201 }));

    await expect(createApiKey(INPUT, fetcher)).resolves.toEqual({ ok: false });
  });
});

describe("revokeApiKey", () => {
  it("DELETEs the key endpoint", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(revokeApiKey("k1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/api-keys/k1");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("same-origin");
  });

  it("keeps the error code and request id", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "not_found", request_id: "req-404" } }, 404),
    );

    await expect(revokeApiKey("missing", fetcher)).resolves.toEqual({
      ok: false,
      code: "not_found",
      requestId: "req-404",
    });
  });
});
