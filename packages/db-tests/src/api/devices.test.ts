import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  devicesRoute,
  registerDeviceRoute,
  revokeDeviceRoute,
  type DevicesRouteDeps,
} from "@027apps/core/devices/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const email = (name: string) => `dev-api-${name}-${Date.now()}-${Math.random()}@test.local`;

function deps(c: ClientBase, who: Caller): DevicesRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: () => {},
  };
  return {
    door,
    auth: async () => who,
    devices: { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } },
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

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function caller(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("devices API", () => {
  it("requires a session", async () => {
    await inRollback(async (c) => {
      const res = await registerDeviceRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/devices", post({ platform: "android" })),
      );
      expect(res.status).toBe(401);
    });
  });

  it("registers, lists, filters and revokes a device", async () => {
    await inRollback(async (c) => {
      const admin = await caller(c, "admin");
      const owner = await caller(c, "user");
      const other = await caller(c, "user");

      const created = await registerDeviceRoute(deps(c, owner))(
        new Request(
          "http://local/api/v1/devices",
          post({ platform: "android", push_token: "fcm-api-0001" }),
        ),
      );
      expect(created.status).toBe(200);
      const body = (await created.json()) as { device: { id: string; user_id: string } };
      expect(body.device.user_id).toBe(owner.userId);

      const own = await devicesRoute(deps(c, owner))(new Request("http://local/api/v1/devices"));
      expect(((await own.json()) as { devices: unknown[] }).devices).toHaveLength(1);

      const forbidden = await devicesRoute(deps(c, owner))(
        new Request(`http://local/api/v1/devices?user=${other.userId}`),
      );
      expect(forbidden.status).toBe(403);

      const panel = await devicesRoute(deps(c, admin))(
        new Request(`http://local/api/v1/devices?user=${owner.userId}`),
      );
      expect(panel.status).toBe(200);
      expect(((await panel.json()) as { devices: unknown[] }).devices).toHaveLength(1);

      const revoked = await revokeDeviceRoute(deps(c, owner))(
        new Request(`http://local/api/v1/devices/${body.device.id}`, { method: "DELETE" }),
        body.device.id,
      );
      expect(revoked.status).toBe(204);
      const { rows } = await query(c, "select revoked_at from public.devices where id = $1", [
        body.device.id,
      ]);
      expect(rows[0]!.revoked_at).not.toBeNull();
    });
  });

  it("rejects a malformed id and an invalid platform", async () => {
    await inRollback(async (c) => {
      const who = await caller(c, "user");
      const badId = await revokeDeviceRoute(deps(c, who))(
        new Request("http://local/api/v1/devices/not-a-uuid", { method: "DELETE" }),
        "not-a-uuid",
      );
      expect(badId.status).toBe(400);

      const badPlatform = await registerDeviceRoute(deps(c, who))(
        new Request("http://local/api/v1/devices", post({ platform: "windows" })),
      );
      expect(badPlatform.status).toBe(400);
    });
  });
});
