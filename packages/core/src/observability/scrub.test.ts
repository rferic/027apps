import { describe, expect, it } from "vitest";
import { scrubEvent } from "./scrub.js";

const event = (overrides: Record<string, unknown> = {}) => ({
  message: "boom",
  request: { headers: { authorization: "Bearer x" }, data: { password: "x" } },
  user: { id: "u1", ip: "1.2.3.4", email: "admin@example.com" },
  breadcrumbs: [{ message: "clicked" }],
  extra: { body: "raw" },
  tags: { status_code: "500", url: "https://panel.test/api/v1/settings" },
  ...overrides,
});

describe("scrubEvent", () => {
  it("removes request, breadcrumbs, extra, IP and email", () => {
    const cleaned = scrubEvent(event())!;

    expect(cleaned.request).toBeUndefined();
    expect(cleaned.breadcrumbs).toBeUndefined();
    expect(cleaned.extra).toBeUndefined();
    expect(cleaned.user).toEqual({ id: "u1" });
    expect(JSON.stringify(cleaned)).not.toContain("1.2.3.4");
    expect(JSON.stringify(cleaned)).not.toContain("admin@example.com");
  });

  it("drops 4xx events", () => {
    expect(scrubEvent(event({ tags: { status_code: "404" } }))).toBeNull();
    expect(scrubEvent(event({ tags: { status_code: "400" } }))).toBeNull();
  });

  it("drops the operational /health 503", () => {
    expect(
      scrubEvent(
        event({ tags: { status_code: "503", url: "https://panel.test/api/v1/health" } }),
      ),
    ).toBeNull();
  });

  it("keeps other 5xx events", () => {
    expect(scrubEvent(event({ tags: { status_code: "500" } }))).not.toBeNull();
  });

  it("fails closed when scrubbing throws", () => {
    const hostile = {
      get request() {
        throw new Error("boom");
      },
    };
    expect(scrubEvent(hostile as unknown as Parameters<typeof scrubEvent>[0])).toBeNull();
  });
});

describe("scrubEvent — real Sentry shape", () => {
  it("reads the status from contexts.response", () => {
    expect(scrubEvent({ contexts: { response: { status_code: 404 } } })).toBeNull();
    expect(
      scrubEvent({
        contexts: { response: { status_code: 503 } },
        request: { url: "https://panel.test/api/v1/health" },
      }),
    ).toBeNull();
  });

  it("keeps only the opaque user id (allowlist)", () => {
    const cleaned = scrubEvent({
      user: { id: "u1", ip: "1.2.3.4", email: "admin@example.com", username: "admin" },
    })!;
    expect(cleaned.user).toEqual({ id: "u1" });
  });

  it("trims stack frames and removes source snippets", () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({
      filename: `frame-${i}.ts`,
      context_line: "const token = 'secret'",
    }));
    const cleaned = scrubEvent({ exception: { values: [{ stacktrace: { frames } }] } })!;
    const kept = cleaned.exception?.values?.[0]?.stacktrace?.frames ?? [];
    expect(kept).toHaveLength(20);
    expect(kept[0]).not.toHaveProperty("context_line");
  });
});
