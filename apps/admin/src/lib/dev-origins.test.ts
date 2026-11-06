/**
 * Next.js only allows `localhost` and `**.localhost` in development by default;
 * extra hosts must be listed or the client never hydrates.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("allowedDevOrigins", () => {
  it.each(["127.0.0.1", "192.168.1.*", "027apps.local"])("allows %s in development", (origin) => {
    expect(nextConfig.allowedDevOrigins).toContain(origin);
  });
});
