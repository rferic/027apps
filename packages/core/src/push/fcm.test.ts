import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createFcmPush } from "./fcm";

/**
 * The FCM HTTP v1 contract. There is no Firebase project in the test
 * environment, so the transport is a fake: what is checked is the request the
 * server builds — the OAuth2 assertion, the per-token message and how FCM
 * errors map to what the outbox retries or drops.
 */

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = JSON.stringify({
  project_id: "familia-test",
  client_email: "push@familia-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** A fake fetch: token endpoint first, then one answer per FCM send. */
function fakeFcm(responses: Array<{ status?: number; body?: unknown }> = []) {
  const calls: Recorded[] = [];
  const fetchFn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const headers = Object.fromEntries(
      Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    calls.push({ url, method: init.method ?? "GET", headers, body: String(init.body ?? "") });
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "ytoken", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const next = responses.shift() ?? {};
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

describe("createFcmPush", () => {
  it("returns null for a service account it cannot read", () => {
    expect(createFcmPush("not json")).toBeNull();
    expect(createFcmPush(JSON.stringify({ project_id: "x" }))).toBeNull();
  });

  it("exchanges a signed assertion for a token and sends a data-only message", async () => {
    const { fetchFn, calls } = fakeFcm();
    const push = createFcmPush(account, fetchFn)!;

    const results = await push.send(["device-token-1"], {
      key: "push.invitation_requested",
      module: "027apps",
    });

    expect(results).toEqual([{ token: "device-token-1" }]);

    const token = calls[0]!;
    expect(token.url).toBe("https://oauth2.googleapis.com/token");
    expect(token.method).toBe("POST");
    const params = new URLSearchParams(token.body);
    expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(params.get("assertion")!.split(".")).toHaveLength(3);

    const message = calls[1]!;
    expect(message.url).toBe(
      "https://fcm.googleapis.com/v1/projects/familia-test/messages:send",
    );
    expect(message.headers.authorization).toBe("Bearer ytoken");
    const body = JSON.parse(message.body) as { message: Record<string, unknown> };
    expect(body.message).toEqual({
      token: "device-token-1",
      data: { key: "push.invitation_requested", module: "027apps" },
    });
    // Data only: the server never composes text (the app localizes it).
    expect(body.message).not.toHaveProperty("notification");
  });

  it("reuses the access token across sends", async () => {
    const { fetchFn, calls } = fakeFcm();
    const push = createFcmPush(account, fetchFn)!;

    await push.send(["a"], { key: "push.one" });
    await push.send(["b"], { key: "push.two" });

    expect(calls.filter((call) => call.url.includes("oauth2"))).toHaveLength(1);
    expect(calls.filter((call) => call.url.includes("messages:send"))).toHaveLength(2);
  });

  it("maps FCM errors to what the outbox does with them", async () => {
    const { fetchFn } = fakeFcm([
      { status: 404, body: { error: { status: "NOT_FOUND" } } },
      { status: 400, body: { error: { status: "INVALID_ARGUMENT" } } },
      { status: 503, body: { error: { status: "UNAVAILABLE" } } },
    ]);
    const push = createFcmPush(account, fetchFn)!;

    const results = await push.send(["gone", "bad", "busy"], { key: "push.x" });

    expect(results).toEqual([
      { token: "gone", error: "UNREGISTERED" },
      { token: "bad", error: "INVALID_ARGUMENT" },
      { token: "busy", error: "RETRY" },
    ]);
  });

  it("fails loudly when the token exchange is rejected", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    ) as unknown as typeof fetch;
    const push = createFcmPush(account, fetchFn)!;

    await expect(push.send(["device"], { key: "push.x" })).rejects.toThrow(
      "FCM token exchange failed",
    );
  });
});
