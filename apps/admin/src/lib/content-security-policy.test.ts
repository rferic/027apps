import { afterEach, describe, expect, it, vi } from "vitest";

import { enforcedCsp, strictReportOnlyCsp } from "./content-security-policy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enforcedCsp", () => {
  it("locks every source to the panel origin", () => {
    const csp = enforcedCsp(false);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("keeps the directives in order and terminated with a semicolon", () => {
    expect(enforcedCsp(false)).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self'; " +
        "upgrade-insecure-requests;",
    );
  });

  it("allows eval only in development", () => {
    expect(enforcedCsp(true)).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval';");
    expect(enforcedCsp(false)).not.toContain("'unsafe-eval'");
  });

  it("omits upgrade-insecure-requests in development", () => {
    expect(enforcedCsp(true)).not.toContain("upgrade-insecure-requests");
  });

  it("adds upgrade-insecure-requests outside development", () => {
    expect(enforcedCsp(false)).toContain("upgrade-insecure-requests");
  });
});

describe("strictReportOnlyCsp", () => {
  it("carries the per-request nonce", () => {
    const csp = strictReportOnlyCsp("abc123", false);

    expect(csp).toContain("'nonce-abc123'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it("allows eval only in development", () => {
    expect(strictReportOnlyCsp("abc123", true)).toContain("'unsafe-eval'");
    expect(strictReportOnlyCsp("abc123", false)).not.toContain("'unsafe-eval'");
  });

  it("allows the Supabase origin in connect-src when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(strictReportOnlyCsp("abc123", false)).toContain(
      "connect-src 'self' https://project.supabase.co",
    );
  });
});
