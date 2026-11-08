import { describe, expect, it, vi } from "vitest";
import { activateModule, deactivateModule, uninstallModule } from "./module-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function call(fetcher: ReturnType<typeof vi.fn>): [string, RequestInit] {
  return fetcher.mock.calls[0] as unknown as [string, RequestInit];
}

describe("activateModule", () => {
  it("POSTs the activate endpoint with the session cookie", async () => {
    const fetcher = vi.fn(async () => json({ module: { key: "inventory" } }));

    await expect(activateModule("inventory", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/modules/inventory/activate");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.body).toBeUndefined();
  });

  it("escapes the key in the path", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await activateModule("a/b", fetcher);

    expect(call(fetcher)[0]).toBe("/api/v1/modules/a%2Fb/activate");
  });

  it("keeps the conflict code and request id", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "conflict", request_id: "req-409" } }, 409),
    );

    await expect(activateModule("inventory", fetcher)).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-409",
    });
  });
});

describe("deactivateModule", () => {
  it("POSTs the deactivate endpoint", async () => {
    const fetcher = vi.fn(async () => json({ module: { key: "inventory" } }));

    await expect(deactivateModule("inventory", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/modules/inventory/deactivate");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
  });

  it("degrades a bare 404 to a plain failure", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 404 }));

    await expect(deactivateModule("missing", fetcher)).resolves.toEqual({ ok: false });
  });
});

describe("uninstallModule", () => {
  it("POSTs the confirmation flag and accepts the 204", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(uninstallModule("inventory", false, fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = call(fetcher);
    expect(url).toBe("/api/v1/modules/inventory/uninstall");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ confirm: false });
  });

  it("sends confirm: true on the second attempt", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await uninstallModule("inventory", true, fetcher);

    expect(JSON.parse(String(call(fetcher)[1].body))).toEqual({ confirm: true });
  });

  it("propagates the conflict when the module still has active grants", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "conflict", request_id: "req-409" } }, 409),
    );

    await expect(uninstallModule("inventory", false, fetcher)).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-409",
    });
  });

  it("keeps a domain detail code so the page can explain it", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: { code: "grants_active" },
          },
        },
        400,
      ),
    );

    await expect(uninstallModule("inventory", false, fetcher)).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: { code: "grants_active" },
    });
  });

  it("does not treat a 200 HTML page as success", async () => {
    const fetcher = vi.fn(async () => new Response("<html></html>", { status: 200 }));

    await expect(uninstallModule("inventory", false, fetcher)).resolves.toEqual({ ok: false });
  });
});
