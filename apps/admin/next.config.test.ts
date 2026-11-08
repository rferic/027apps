import { describe, expect, it } from "vitest";
import config from "./next.config";

/**
 * Access log and analytics aside, the token lives in the invite URL. An HTTP
 * header overrides the page's `<meta name="referrer">`, so the rule has to
 * exist here too, and it must come after the global one: the last match wins.
 */
describe("next.config headers", () => {
  it("sends no referrer and no indexing for the invitation page", async () => {
    const rules = await config.headers?.();

    expect(rules).toBeDefined();
    const global = rules?.find((rule) => rule.source === "/:path*");
    const invite = rules?.find((rule) => rule.source === "/invite/:token");

    expect(global?.headers.find((header) => header.key === "Referrer-Policy")?.value).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(invite?.headers).toEqual(
      expect.arrayContaining([
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ]),
    );
  });

  it("declares the invite rule after the global one so it wins", async () => {
    const rules = (await config.headers?.()) ?? [];
    const globalIndex = rules.findIndex((rule) => rule.source === "/:path*");
    const inviteIndex = rules.findIndex((rule) => rule.source === "/invite/:token");

    expect(globalIndex).toBeGreaterThanOrEqual(0);
    expect(inviteIndex).toBeGreaterThan(globalIndex);
  });

  it("denies camera, microphone and geolocation for every response", async () => {
    const rules = (await config.headers?.()) ?? [];
    const global = rules.find((rule) => rule.source === "/:path*");

    expect(global?.headers.find((header) => header.key === "Permissions-Policy")?.value).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("leaves HSTS to the platform", async () => {
    const rules = (await config.headers?.()) ?? [];

    expect(
      rules.flatMap((rule) => rule.headers).find((header) => header.key === "Strict-Transport-Security"),
    ).toBeUndefined();
  });
});
