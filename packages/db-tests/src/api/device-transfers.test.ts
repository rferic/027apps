import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  createDeviceTransferRoute,
  deviceTransferStatusRoute,
  exchangeDeviceTransferRoute,
  revokeOtherDevicesRoute,
  registerDeviceRoute,
  type DevicesRouteDeps,
} from "@027apps/core/devices/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const email = (name: string) => `mig-${name}-${Date.now()}-${Math.random()}@test.local`;

function deps(c: ClientBase, who: Caller, userEmail: string): DevicesRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: () => {},
  };
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    door,
    auth: async () => who,
    devices: { db },
    transfers: {
      db,
      auth: {
        async getUserEmail() {
          return userEmail;
        },
        async createMagicLink() {
          return { tokenHash: "magic-hash" };
        },
      },
    },
  };
}

function post(body?: unknown): RequestInit {
  return {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
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

describe("device transfer routes", () => {
  it("creates, polls and exchanges a code exactly once", async () => {
    await inRollback(async (c) => {
      const value = email("flow");
      const { id } = await createTestUser(c, { email: value });
      const who: Caller = { kind: "session", userId: id, role: "user" };
      const route = deps(c, who, value);

      const created = await createDeviceTransferRoute(route)(
        new Request("http://local/api/v1/me/device-transfers", post()),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as {
        transfer: { id: string; expires_at: string };
        token: string;
        path: string;
      };
      expect(body.token).toMatch(/^027_mig_/);
      expect(body.path).toBe(`/migrate/${body.token}`);
      expect(created.headers.get("cache-control")).toBe("no-store");

      const pending = await deviceTransferStatusRoute(route)(
        new Request(`http://local/api/v1/me/device-transfers/${body.transfer.id}`),
        body.transfer.id,
      );
      expect(pending.status).toBe(200);
      expect(((await pending.json()) as { transfer: { state: string } }).transfer.state).toBe(
        "pending",
      );

      const exchanged = await exchangeDeviceTransferRoute(route)(
        new Request(`http://local/api/v1/device-transfers/${body.token}/exchange`, post()),
        body.token,
      );
      expect(exchanged.status).toBe(200);
      expect(await exchanged.json()).toEqual({
        transfer_id: body.transfer.id,
        email: value,
        token_hash: "magic-hash",
        expires_at: body.transfer.expires_at,
      });
      expect(exchanged.headers.get("cache-control")).toBe("no-store");

      const used = await deviceTransferStatusRoute(route)(
        new Request(`http://local/api/v1/me/device-transfers/${body.transfer.id}`),
        body.transfer.id,
      );
      expect(((await used.json()) as { transfer: { state: string } }).transfer.state).toBe("used");

      const again = await exchangeDeviceTransferRoute(route)(
        new Request(`http://local/api/v1/device-transfers/${body.token}/exchange`, post()),
        body.token,
      );
      expect(again.status).toBe(404);
    });
  });

  it("does not let another user read the transfer", async () => {
    await inRollback(async (c) => {
      const ownerEmail = email("owner");
      const owner = await createTestUser(c, { email: ownerEmail });
      const other = await createTestUser(c, { email: email("other") });
      const ownerRoute = deps(c, { kind: "session", userId: owner.id, role: "user" }, ownerEmail);

      const created = await createDeviceTransferRoute(ownerRoute)(
        new Request("http://local/api/v1/me/device-transfers", post()),
      );
      const { transfer } = (await created.json()) as { transfer: { id: string } };

      const otherRoute = deps(
        c,
        { kind: "session", userId: other.id, role: "user" },
        email("other"),
      );
      const hidden = await deviceTransferStatusRoute(otherRoute)(
        new Request(`http://local/api/v1/me/device-transfers/${transfer.id}`),
        transfer.id,
      );
      expect(hidden.status).toBe(404);
    });
  });

  it("revokes every other device and keeps the new one", async () => {
    await inRollback(async (c) => {
      const value = email("revoke");
      const { id } = await createTestUser(c, { email: value });
      const who: Caller = { kind: "session", userId: id, role: "user" };
      const route = deps(c, who, value);

      const first = await registerDeviceRoute(route)(
        new Request(
          "http://local/api/v1/devices",
          post({ platform: "android", push_token: "push-token-one-123" }),
        ),
      );
      const second = await registerDeviceRoute(route)(
        new Request(
          "http://local/api/v1/devices",
          post({ platform: "android", push_token: "push-token-two-123" }),
        ),
      );
      const keep = ((await second.json()) as { device: { id: string } }).device.id;
      expect(first.status).toBe(200);

      const revoked = await revokeOtherDevicesRoute(route)(
        new Request(
          "http://local/api/v1/me/devices/revoke-others",
          post({ keep_device_id: keep }),
        ),
      );
      expect(revoked.status).toBe(200);
      expect(await revoked.json()).toEqual({ revoked: 1 });

      const { rows } = await query(
        c,
        "select revoked_at from public.devices where user_id = $1 order by id",
        [id],
      );
      const kept = rows.find((row) => row.revoked_at === null);
      expect(kept).toBeDefined();
    });
  });

  it("revokes every device when the new phone could not register push", async () => {
    await inRollback(async (c) => {
      const value = email("revoke-all");
      const { id } = await createTestUser(c, { email: value });
      const who: Caller = { kind: "session", userId: id, role: "user" };
      const route = deps(c, who, value);

      await registerDeviceRoute(route)(
        new Request(
          "http://local/api/v1/devices",
          post({ platform: "android", push_token: "push-token-old-123" }),
        ),
      );

      const revoked = await revokeOtherDevicesRoute(route)(
        new Request(
          "http://local/api/v1/me/devices/revoke-others",
          post({ keep_device_id: null }),
        ),
      );
      expect(revoked.status).toBe(200);
      expect(await revoked.json()).toEqual({ revoked: 1 });

      const { rows } = await query(
        c,
        "select revoked_at from public.devices where user_id = $1",
        [id],
      );
      expect(rows.every((row) => row.revoked_at !== null)).toBe(true);
    });
  });
});
