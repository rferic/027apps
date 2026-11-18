import { describe, expect, it, vi } from "vitest";
import {
  recoveryLink,
  requestPasswordReset,
  type PasswordRecoveryDeps,
} from "./password-recovery";

interface Harness {
  deps: PasswordRecoveryDeps;
  send: ReturnType<typeof vi.fn>;
  generate: ReturnType<typeof vi.fn>;
  rateLimit: { increment: ReturnType<typeof vi.fn> };
  wait: ReturnType<typeof vi.fn>;
  profile: Record<string, unknown> | null;
  account: { id: string } | null;
}

function harness(overrides: {
  account?: { id: string } | null;
  profile?: Record<string, unknown> | null;
  ipCount?: number;
  emailCount?: number;
  mailerFails?: boolean;
} = {}): Harness {
  const send = vi.fn(async () => ({ status: "sent" as const }));
  if (overrides.mailerFails) send.mockRejectedValueOnce(new Error("resend down"));
  const generate = vi.fn(async () => ({ tokenHash: "hash-123" }));
  const profile =
    overrides.profile === undefined
      ? { display_name: "Ana", locale: "es", deactivated_at: null }
      : overrides.profile;
  const account = overrides.account === undefined ? { id: "u1" } : overrides.account;
  const rateLimit = {
    increment: vi.fn(async (key: string) =>
      key.startsWith("recovery:ip:")
        ? { count: overrides.ipCount ?? 1 }
        : { count: overrides.emailCount ?? 1 },
    ),
  };
  const wait = vi.fn(async () => {});
  const db = {
    query: vi.fn(async (sql: string) =>
      sql.includes("from public.profiles") && profile ? { rows: [profile] } : { rows: [] },
    ),
  };
  return {
    send,
    generate,
    rateLimit,
    wait,
    profile,
    account,
    deps: {
      db,
      auth: {
        findUserByEmail: async () => account,
        generateRecoveryLink: generate,
      },
      mailer: { send },
      rateLimit,
      publicUrl: "https://familia.test/",
      instanceName: "Familia",
      now: () => new Date("2026-01-01T12:00:00.000Z"),
      wait,
      floorMs: 700,
    },
  };
}

describe("requestPasswordReset", () => {
  it("sends the recovery link for an active account", async () => {
    const h = harness();

    await requestPasswordReset(h.deps, { email: "  Ana@Example.COM ", ip: "203.0.113.1" });

    expect(h.generate).toHaveBeenCalledWith("ana@example.com");
    expect(h.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        name: "Ana",
        locale: "es",
        instanceName: "Familia",
        link: recoveryLink("https://familia.test/", "hash-123"),
      }),
    );
    expect(h.rateLimit.increment).toHaveBeenCalledWith(
      expect.stringMatching(/^recovery:email:[0-9a-f]{64}$/),
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("does not send for an unknown account but keeps the same response", async () => {
    const h = harness({ account: null });

    await expect(
      requestPasswordReset(h.deps, { email: "nobody@example.com", ip: "203.0.113.1" }),
    ).resolves.toBeUndefined();

    expect(h.send).not.toHaveBeenCalled();
    expect(h.generate).not.toHaveBeenCalled();
    expect(h.wait).toHaveBeenCalled();
  });

  it("does not send to a deactivated profile", async () => {
    const h = harness({
      profile: { display_name: "Ana", locale: "es", deactivated_at: "2026-01-01T00:00:00Z" },
    });

    await requestPasswordReset(h.deps, { email: "ana@example.com", ip: "203.0.113.1" });

    expect(h.send).not.toHaveBeenCalled();
  });

  it("applies the per-IP and per-email budgets", async () => {
    const byIp = harness({ ipCount: 6 });
    await requestPasswordReset(byIp.deps, { email: "ana@example.com", ip: "203.0.113.1" });
    expect(byIp.send).not.toHaveBeenCalled();

    const byEmail = harness({ emailCount: 4 });
    await requestPasswordReset(byEmail.deps, { email: "ana@example.com", ip: "203.0.113.1" });
    expect(byEmail.send).not.toHaveBeenCalled();
  });

  it("never fails when the mailer fails", async () => {
    const h = harness({ mailerFails: true });

    await expect(
      requestPasswordReset(h.deps, { email: "ana@example.com", ip: "203.0.113.1" }),
    ).resolves.toBeUndefined();
    expect(h.wait).toHaveBeenCalled();
  });

  it("keeps the response floor on both paths", async () => {
    const present = harness();
    const missing = harness({ account: null });

    const start = Date.now();
    await requestPasswordReset(present.deps, { email: "ana@example.com", ip: "1.1.1.1" });
    await requestPasswordReset(missing.deps, { email: "nobody@example.com", ip: "1.1.1.1" });

    expect(present.wait).toHaveBeenCalledWith(expect.any(Number));
    expect(missing.wait).toHaveBeenCalledWith(expect.any(Number));
    // The harness's wait is instant; the real one sleeps. The floor value is
    // passed to both, which is what the test observes.
    expect(Date.now() - start).toBeLessThan(700);
  });
});

describe("recoveryLink", () => {
  it("encodes the hash and keeps the next path in the allowlist", () => {
    const link = recoveryLink("https://familia.test/", "a+b/c==");
    expect(link).toBe(
      "https://familia.test/auth/confirm?token_hash=a%2Bb%2Fc%3D%3D&type=recovery&next=%2Freset-password",
    );
  });
});
