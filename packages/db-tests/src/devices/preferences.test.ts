import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestModule, createTestUser, impersonate, query, withClient } from "../pg.js";
import type { Caller } from "@027apps/core/api/types.js";
import {
  readNotificationPreferences,
  writeNotificationPreferences,
} from "@027apps/core/devices/preferences.js";
import { registerDevice, type DevicesDeps } from "@027apps/core/devices/service.js";

const email = (name: string) => `dev-prefs-${name}-${Date.now()}-${Math.random()}@test.local`;

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

function deps(c: ClientBase): DevicesDeps {
  return { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } };
}

async function session(c: ClientBase, role: "user" | "admin" = "user"): Promise<Caller> {
  const { id } = await createTestUser(c, { email: email(role), role, displayName: "Ana" });
  return { kind: "session", userId: id, role };
}

function idOf(caller: Caller): string {
  if (caller.kind === "session" || caller.kind === "delegated") return caller.userId;
  throw new Error("a device belongs to a user");
}

function android(c: ClientBase, caller: Caller, token: string) {
  return registerDevice(deps(c), caller, { platform: "android", push_token: token });
}

describe("notification preferences", () => {
  it("starts with everything on, general first and the active module after it", async () => {
    await inRollback(async (c) => {
      await createTestModule(c, "owe-no", "active");
      const who = await session(c);
      const device = await android(c, who, "pref-token-1");

      const prefs = await readNotificationPreferences(deps(c), who, device.id);

      expect(prefs.device).toEqual({ id: device.id, push_enabled: true });
      expect(prefs.groups.map((group) => group.module?.key ?? null)).toEqual([null, "owe-no"]);
      expect(prefs.groups[0]!.types).toEqual([
        { key: "invitation.requested", enabled: true },
        { key: "invitation.request_resolved", enabled: true },
      ]);
      expect(prefs.groups[1]!.types).toEqual([
        { key: "owe_no.movement_created", enabled: true },
        { key: "owe_no.movement_changed", enabled: true },
      ]);
    });
  });

  it("omits a module that is not active", async () => {
    await inRollback(async (c) => {
      const who = await session(c);
      const device = await android(c, who, "pref-token-2");
      const { rows } = await query(
        c,
        "select 1 from public.module_registry where key = 'owe-no' and state = 'active'",
      );
      const prefs = await readNotificationPreferences(deps(c), who, device.id);
      const modules = prefs.groups.filter((group) => group.module !== null);
      // The local owner's instance usually has OweNo active; a clean CI database does not.
      expect(modules.length).toBe(rows[0] ? 1 : 0);
    });
  });

  it("stores mutes and the master switch, and keeps them across a re-registration", async () => {
    await inRollback(async (c) => {
      const who = await session(c);
      const device = await android(c, who, "pref-token-3");

      await writeNotificationPreferences(deps(c), who, device.id, {
        push_enabled: false,
        muted: ["invitation.requested", "owe_no.movement_changed"],
      });

      // Registering again (a token refresh) must not turn the master back on.
      const again = await android(c, who, "pref-token-3");
      expect(again.push_enabled).toBe(false);

      const prefs = await readNotificationPreferences(deps(c), who, device.id);
      expect(prefs.device.push_enabled).toBe(false);
      const general = prefs.groups.find((group) => group.module === null)!;
      expect(general.types).toEqual([
        { key: "invitation.requested", enabled: false },
        { key: "invitation.request_resolved", enabled: true },
      ]);
    });
  });

  it("replaces the muted set instead of merging with the previous one", async () => {
    await inRollback(async (c) => {
      const who = await session(c);
      const device = await android(c, who, "pref-token-4");
      await writeNotificationPreferences(deps(c), who, device.id, {
        push_enabled: true,
        muted: ["invitation.requested"],
      });
      await writeNotificationPreferences(deps(c), who, device.id, {
        push_enabled: true,
        muted: ["invitation.request_resolved"],
      });

      const prefs = await readNotificationPreferences(deps(c), who, device.id);
      const general = prefs.groups.find((group) => group.module === null)!;
      expect(general.types.map((type) => type.enabled)).toEqual([true, false]);
    });
  });

  it("refuses an unknown or repeated kind", async () => {
    await inRollback(async (c) => {
      const who = await session(c);
      const device = await android(c, who, "pref-token-5");

      await expect(
        writeNotificationPreferences(deps(c), who, device.id, {
          push_enabled: true,
          muted: ["does.not.exist"],
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });

      await expect(
        writeNotificationPreferences(deps(c), who, device.id, {
          push_enabled: true,
          muted: ["invitation.requested", "invitation.requested"],
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });
    });
  });

  it("answers not_found for another user's device", async () => {
    await inRollback(async (c) => {
      const owner = await session(c);
      const stranger = await session(c);
      const device = await android(c, owner, "pref-token-6");

      await expect(
        readNotificationPreferences(deps(c), stranger, device.id),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(
        writeNotificationPreferences(deps(c), stranger, device.id, {
          push_enabled: false,
          muted: [],
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("keeps a device's mutes private under RLS", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        const owner = await session(c);
        const stranger = await session(c);
        const device = await android(c, owner, "pref-token-7");
        await c.query(
          "insert into public.device_notification_mutes (device_id, kind) values ($1, $2)",
          [device.id, "invitation.requested"],
        );

        await impersonate(c, idOf(stranger));
        const { rows } = await query(c, "select kind from public.device_notification_mutes");
        expect(rows).toHaveLength(0);
        await expect(
          c.query(
            "insert into public.device_notification_mutes (device_id, kind) values ($1, $2)",
            [device.id, "invitation.request_resolved"],
          ),
        ).rejects.toThrow();
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });
});
