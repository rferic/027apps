import { describe, expect, it, vi } from "vitest";
import { deactivateMember, patchMember, restoreMember } from "./member-mutations";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("patchMember", () => {
  it("PATCHes the member endpoint same-origin with the expected body", async () => {
    const fetcher = vi.fn(async () => json({ user: {} }));

    const result = await patchMember("u1", {
      display_name: "Ana",
      locale: "es",
      timezone: "Europe/Madrid",
      role: "admin",
    }, fetcher);

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/users/u1");
    expect(init.method).toBe("PATCH");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      display_name: "Ana",
      locale: "es",
      timezone: "Europe/Madrid",
      role: "admin",
    });
  });

  it("returns the translated code and request id on a 409", async () => {
    const fetcher = vi.fn(async () =>
      json(
        { error: { code: "conflict", request_id: "req-409" } },
        409,
        { "x-request-id": "req-header" },
      ),
    );

    await expect(patchMember("u1", { role: "admin" }, fetcher)).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-409",
    });
  });

  it("degrades a network failure to a plain rejection", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(patchMember("u1", { locale: "es" }, fetcher)).resolves.toEqual({ ok: false });
  });

  it("propagates the field and form errors of a validation failure", async () => {
    const fetcher = vi.fn(async () =>
      json(
        {
          error: {
            code: "validation_failed",
            request_id: "req-400",
            details: {
              formErrors: [],
              fieldErrors: { display_name: ["String must contain at most 80 character(s)"] },
            },
          },
        },
        400,
      ),
    );

    await expect(patchMember("u1", { display_name: "x" }, fetcher)).resolves.toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: {
        formErrors: [],
        fieldErrors: { display_name: ["String must contain at most 80 character(s)"] },
      },
    });
  });

  it("rejects a 2xx with a non-JSON body instead of treating it as success", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("<html>maintenance</html>", {
          status: 200,
          headers: { "content-type": "text/html", "x-request-id": "req-html" },
        }),
    );

    await expect(patchMember("u1", { locale: "es" }, fetcher)).resolves.toEqual({
      ok: false,
      requestId: "req-html",
    });
  });

  it("rejects a 2xx whose JSON body is not an object", async () => {
    const fetcher = vi.fn(async () => json([{ id: "u1" }]));

    await expect(patchMember("u1", { locale: "es" }, fetcher)).resolves.toEqual({
      ok: false,
    });
  });

  it("accepts a 204 without a body as success", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(patchMember("u1", { locale: "es" }, fetcher)).resolves.toEqual({ ok: true });
  });
});

describe("deactivateMember", () => {
  it("DELETEs the member endpoint same-origin", async () => {
    const fetcher = vi.fn(async () => json({ user: {} }));

    await expect(deactivateMember("u1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/users/u1");
    expect(init.method).toBe("DELETE");
    expect(init.credentials).toBe("same-origin");
  });

  it("surfaces the API code when the root or the last super_admin is protected", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "conflict", request_id: "req-conflict" } }, 409),
    );

    await expect(deactivateMember("root", fetcher)).resolves.toEqual({
      ok: false,
      code: "conflict",
      requestId: "req-conflict",
    });
  });
});

describe("restoreMember", () => {
  it("POSTs the restore endpoint same-origin", async () => {
    const fetcher = vi.fn(async () => json({ user: {} }));

    await expect(restoreMember("u1", fetcher)).resolves.toEqual({ ok: true });

    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/users/u1/restore");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
  });

  it("surfaces the API code when the caller is not a super_admin", async () => {
    const fetcher = vi.fn(async () =>
      json({ error: { code: "insufficient_scope", request_id: "req-403" } }, 403),
    );

    await expect(restoreMember("u1", fetcher)).resolves.toEqual({
      ok: false,
      code: "insufficient_scope",
      requestId: "req-403",
    });
  });
});
