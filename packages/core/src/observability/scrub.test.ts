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
    expect(scrubEvent(hostile)).toBeNull();
  });
});
