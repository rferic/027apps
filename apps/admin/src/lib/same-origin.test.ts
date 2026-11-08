import { describe, expect, it } from "vitest";
import { isSameOriginMutation } from "./same-origin";

function request(method: string, headers: Record<string, string>) {
  return { method, headers: new Headers(headers) };
}

const SESSION_COOKIE = "sb-project-ref-auth-token=token";

describe("isSameOriginMutation", () => {
  it("lets safe methods through even without Origin", () => {
    expect(
      isSameOriginMutation(request("GET", { cookie: SESSION_COOKIE })),
    ).toBe(true);
    expect(
      isSameOriginMutation(request("HEAD", { cookie: SESSION_COOKIE })),
    ).toBe(true);
    expect(
      isSameOriginMutation(request("OPTIONS", { cookie: SESSION_COOKIE })),
    ).toBe(true);
  });

  it("lets Bearer calls without a session cookie through (API keys and mobile)", () => {
    const result = isSameOriginMutation(
      request("PATCH", { authorization: "Bearer api-key" }),
    );

    expect(result).toBe(true);
  });

  it("accepts a mutation with a matching Origin and Host", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: SESSION_COOKIE,
        origin: "https://panel.example.com",
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(true);
  });

  it("accepts a matching Origin and x-forwarded-host (proxy in front)", () => {
    const result = isSameOriginMutation(
      request("DELETE", {
        cookie: SESSION_COOKIE,
        origin: "https://panel.example.com",
        "x-forwarded-host": "panel.example.com, internal:3003",
      }),
    );

    expect(result).toBe(true);
  });

  it("falls back to Referer when Origin is missing", () => {
    const result = isSameOriginMutation(
      request("POST", {
        cookie: SESSION_COOKIE,
        referer: "https://panel.example.com/members/u1",
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(true);
  });

  it("rejects a cookie mutation from another origin", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: SESSION_COOKIE,
        origin: "https://evil.example",
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(false);
  });

  it("rejects a cookie mutation with no Origin and no Referer", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: SESSION_COOKIE,
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(false);
  });

  it("prefers Origin over Referer when both are present", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: SESSION_COOKIE,
        origin: "https://evil.example",
        referer: "https://panel.example.com/members/u1",
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(false);
  });

  it("rejects a mutation when the request host is missing", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: SESSION_COOKIE,
        origin: "https://panel.example.com",
      }),
    );

    expect(result).toBe(false);
  });

  it("rejects an opaque or malformed Origin", () => {
    expect(
      isSameOriginMutation(
        request("PATCH", {
          cookie: SESSION_COOKIE,
          origin: "null",
          host: "panel.example.com",
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginMutation(
        request("PATCH", {
          cookie: SESSION_COOKIE,
          origin: "not a url",
          host: "panel.example.com",
        }),
      ),
    ).toBe(false);
  });

  it("ignores cookies that are not Supabase session cookies", () => {
    const result = isSameOriginMutation(
      request("PATCH", {
        cookie: "027_locale=es; analytics=1",
        origin: "https://evil.example",
        host: "panel.example.com",
      }),
    );

    expect(result).toBe(true);
  });
});
