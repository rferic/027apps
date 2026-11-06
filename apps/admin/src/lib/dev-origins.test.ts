import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next dev origins", () => {
  it("allows the loopback IP so the client hydrates when opened as 127.0.0.1", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
