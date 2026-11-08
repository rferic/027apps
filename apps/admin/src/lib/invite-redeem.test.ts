import { describe, expect, it, vi } from "vitest";
import { redeemInvitation } from "./invite-redeem";

const INPUT = {
  token: "027_inv_abc123",
  email: "  ana@example.com  ",
  password: "correct horse battery",
};

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Typed call log for the injected fetcher. */
function capture(response: () => Response) {
  const calls: Array<[string, RequestInit]> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push([String(input), init ?? {}]);
    return response();
  };
  return { fetcher, calls };
}

describe("redeemInvitation", () => {
  it("posts the email and password to the token URL without the token in the body", async () => {
    const { fetcher, calls } = capture(() => jsonResponse({ user: { id: "u1" } }, 201));

    const result = await redeemInvitation(INPUT, fetcher);

    expect(result).toEqual({ ok: true });
    const [url, init] = calls[0];
    expect(url).toBe("/api/v1/invitations/027_inv_abc123/redeem");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ email: "ana@example.com", password: INPUT.password }));
    expect(String(init.body)).not.toContain("027_inv_");
  });

  it("encodes a hostile token instead of appending it raw", async () => {
    const { fetcher, calls } = capture(() => jsonResponse({}, 201));

    await redeemInvitation({ ...INPUT, token: "027_inv_a/../b" }, fetcher);

    const [url] = calls[0];
    expect(url).toBe(`/api/v1/invitations/${encodeURIComponent("027_inv_a/../b")}/redeem`);
  });

  it("treats 204 as success", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({ ok: true });
  });

  it("returns the invitation_used code and request id from a 409", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        { error: { code: "invitation_used", request_id: "req-1" } },
        409,
        { "x-request-id": "req-1" },
      ),
    );

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({
      ok: false,
      code: "invitation_used",
      requestId: "req-1",
    });
  });

  it("returns not_found from a 404", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: { code: "not_found" } }, 404));

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("returns rate_limited from a 429", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: { code: "rate_limited" } }, 429));

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({
      ok: false,
      code: "rate_limited",
    });
  });

  it("rejects a 2xx HTML page instead of reading it as success", async () => {
    const fetcher = vi.fn(
      async () => new Response("<html>proxy</html>", { status: 200 }),
    );

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({ ok: false });
  });

  it("rejects a 200 JSON object because the contract only creates with 201", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ user: { id: "u1" } }, 200));

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({ ok: false });
  });

  it("rejects a 201 with a non-object body", async () => {
    const fetcher = vi.fn(async () => jsonResponse([1, 2], 201));

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({ ok: false });
  });

  it("returns a failure without a code when the network drops", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(redeemInvitation(INPUT, fetcher)).resolves.toEqual({ ok: false });
  });
});
