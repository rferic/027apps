import { describe, expect, it, vi } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  listDevices,
  registerDevice,
  revokeDevice,
  type DevicesDeps,
} from "@027apps/core/devices/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const email = (name: string) => `dev-${name}-${Date.now()}-${Math.random()}@test.local`;

function deps(c: ClientBase, revokeSessions?: (userId: string) => Promise<void>): DevicesDeps {
  return {
    db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
    ...(revokeSessions ? { revokeSessions } : {}),
  };
}

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("devices service", () => {
  it("registers idempotently by push_token and reassigns it to a new user", async () => {
    await inRollback(async (c) => {
      const first = await session(c, "user");
      const second = await session(c, "user");

      const device = await registerDevice(deps(c), first, {
        platform: "android",
        push_token: "fcm-token-0001",
      });
      expect(device.user_id).toBe(first.userId);

      const again = await registerDevice(deps(c), first, {
        platform: "android",
        push_token: "fcm-token-0001",
      });
      expect(again.id).toBe(device.id);
      expect(again.last_seen_at >= device.last_seen_at).toBe(true);

      const moved = await registerDevice(deps(c), second, {
        platform: "android",
        push_token: "fcm-token-0001",
      });
      expect(moved.id).toBe(device.id);
      expect(moved.user_id).toBe(second.userId);
    });
  });

  it("creates a device without a push token", async () => {
    await inRollback(async (c) => {
      const who = await session(c, "user");
      const device = await registerDevice(deps(c), who, { platform: "android" });
      expect(device.push_token).toBeNull();
      expect(device.user_id).toBe(who.userId);
    });
  });

  it("lists own devices and lets admins inspect another user", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const owner = await session(c, "user");
      const other = await session(c, "user");
      await registerDevice(deps(c), owner, { platform: "android", push_token: "fcm-owner-1" });
      await registerDevice(deps(c), other, { platform: "android", push_token: "fcm-other-1" });

      expect(await listDevices(deps(c), owner)).toHaveLength(1);
      expect(await listDevices(deps(c), admin, { user_id: owner.userId })).toHaveLength(1);
      await expect(listDevices(deps(c), owner, { user_id: other.userId })).rejects.toMatchObject({
        code: "insufficient_scope",
      });
      await expect(
        listDevices(deps(c), { kind: "service", keyId: "k", scopes: [], roleCap: "admin" }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });

  it("revokes as owner or admin and drops the owner's sessions", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const owner = await session(c, "user");
      const other = await session(c, "user");
      const revokeSessions = vi.fn(async () => undefined);
      const device = await registerDevice(deps(c), owner, {
        platform: "android",
        push_token: "fcm-revoke-1",
      });

      await expect(revokeDevice(deps(c, revokeSessions), other, device.id)).rejects.toMatchObject({
        code: "not_found",
      });
      await revokeDevice(deps(c, revokeSessions), admin, device.id);

      const { rows } = await query(c, "select revoked_at from public.devices where id = $1", [device.id]);
      expect(rows[0]!.revoked_at).not.toBeNull();
      expect(revokeSessions).toHaveBeenCalledWith(owner.userId);
      await expect(revokeDevice(deps(c), admin, crypto.randomUUID())).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  it("refuses device writes from a service key", async () => {
    await inRollback(async (c) => {
      const service: Caller = {
        kind: "service",
        keyId: "k1",
        scopes: ["devices:write"],
        roleCap: "admin",
      };
      await expect(
        registerDevice(deps(c), service, { platform: "android", push_token: "fcm-service" }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });
});
