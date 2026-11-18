import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage";
import type { Caller } from "../api/types";
import {
  createDeviceTransfer,
  exchangeDeviceTransfer,
  getDeviceTransferStatus,
  hashDeviceTransferToken,
  type DeviceTransfersDeps,
} from "./transfers";

const SESSION: Caller = { kind: "session", userId: "u1", role: "user" };
const NOW = new Date("2026-11-17T12:00:00.000Z");

const TRANSFER = {
  id: "t1",
  user_id: "u1",
  code_hash: "a".repeat(64),
  expires_at: "2026-11-17T12:01:00.000Z",
  used_at: null,
  created_at: "2026-11-17T12:00:00.000Z",
};

interface Harness {
  deps: DeviceTransfersDeps;
  queries: { sql: string; params: unknown[] }[];
  createMagicLink: ReturnType<typeof vi.fn>;
  getUserEmail: ReturnType<typeof vi.fn>;
}

function harness(
  transfer: Record<string, unknown> | null = TRANSFER,
  profile: Record<string, unknown> | null = { deactivated_at: null },
): Harness {
  const queries: { sql: string; params: unknown[] }[] = [];
  const createMagicLink = vi.fn(async () => ({ tokenHash: "magic-hash" }));
  const getUserEmail = vi.fn(async () => "ana@example.test");
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (sql.includes("insert into public.device_transfers")) {
        return { rows: [{ id: "t1" }] };
      }
      if (sql.includes("from public.device_transfers") && sql.includes("for update")) {
        return { rows: transfer ? [transfer] : [] };
      }
      if (sql.includes("from public.device_transfers")) {
        return { rows: transfer ? [transfer] : [] };
      }
      if (sql.includes("select deactivated_at from public.profiles")) {
        return { rows: profile ? [profile] : [] };
      }
      return { rows: [] };
    },
  };
  return {
    queries,
    createMagicLink,
    getUserEmail,
    deps: {
      db,
      auth: { createMagicLink, getUserEmail },
      now: () => NOW,
    },
  };
}

describe("createDeviceTransfer", () => {
  it("mints a 60-second token returning only its hash", async () => {
    const h = harness();

    const created = await createDeviceTransfer(h.deps, SESSION);

    expect(created.token).toMatch(/^027_mig_[A-Za-z0-9_-]+$/);
    expect(created.path).toBe(`/migrate/${created.token}`);
    expect(created.transfer.id).toBe("t1");
    expect(created.transfer.expires_at).toBe("2026-11-17T12:01:00.000Z");
    const insert = h.queries.find((q) => q.sql.includes("insert into public.device_transfers"));
    expect(insert?.params[1]).toBe(hashDeviceTransferToken(created.token));
  });

  it("cleans old rows before inserting", async () => {
    const h = harness();
    await createDeviceTransfer(h.deps, SESSION);
    expect(h.queries.some((q) => q.sql.includes("delete from public.device_transfers"))).toBe(true);
  });

  it("refuses a service or delegated caller", async () => {
    const h = harness();
    await expect(
      createDeviceTransfer(h.deps, {
        kind: "service",
        keyId: "k1",
        scopes: ["devices:revoke"],
        roleCap: "admin",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});

describe("getDeviceTransferStatus", () => {
  it("reports the pending state for the owner", async () => {
    const h = harness();
    await expect(getDeviceTransferStatus(h.deps, SESSION, "t1")).resolves.toMatchObject({
      id: "t1",
      state: "pending",
      used_at: null,
    });
  });

  it("reports used and expired", async () => {
    const used = harness({ ...TRANSFER, used_at: "2026-11-17T12:00:30.000Z" });
    expect((await getDeviceTransferStatus(used.deps, SESSION, "t1")).state).toBe("used");

    const expired = harness({ ...TRANSFER, expires_at: "2026-11-17T11:59:00.000Z" });
    expect((await getDeviceTransferStatus(expired.deps, SESSION, "t1")).state).toBe("expired");
  });

  it("hides another user's transfer behind not_found", async () => {
    const h = harness({ ...TRANSFER, user_id: "u2" });
    await expect(getDeviceTransferStatus(h.deps, SESSION, "t1")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("exchangeDeviceTransfer", () => {
  it("mints the magic link, marks it used and returns no session", async () => {
    const h = harness();

    const result = await exchangeDeviceTransfer(h.deps, "027_mig_validtoken");

    expect(result).toEqual({
      transfer_id: "t1",
      email: "ana@example.test",
      token_hash: "magic-hash",
      expires_at: TRANSFER.expires_at,
    });
    expect(h.queries.some((q) => q.sql.includes("set used_at = now()"))).toBe(true);
  });

  it("rejects a used, expired or unknown token with the same not_found", async () => {
    await expect(
      exchangeDeviceTransfer(harness({ ...TRANSFER, used_at: NOW.toISOString() }).deps, "027_mig_x"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      exchangeDeviceTransfer(
        harness({ ...TRANSFER, expires_at: "2026-11-17T11:59:00.000Z" }).deps,
        "027_mig_x",
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(exchangeDeviceTransfer(harness(null).deps, "027_mig_x")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(exchangeDeviceTransfer(harness().deps, "nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("rejects a deactivated profile", async () => {
    const h = harness(TRANSFER, { deactivated_at: NOW.toISOString() });
    await expect(exchangeDeviceTransfer(h.deps, "027_mig_x")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(h.createMagicLink).not.toHaveBeenCalled();
  });
});
