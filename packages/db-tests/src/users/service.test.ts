import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  deactivateUser,
  getUser,
  listUsers,
  updateUser,
  type Role,
} from "@027apps/core/users/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const deps = (c: ClientBase) => ({
  db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
});

const caller = (role: Role): Caller => ({ kind: "session", userId: "caller", role });

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

const email = (name: string) => `users-${name}-${Date.now()}-${Math.random()}@test.local`;

async function makeRootSuperAdmin(c: ClientBase, name: string): Promise<string> {
  const { id } = await createTestUser(c, { email: email(name), role: "super_admin", displayName: name });
  await query(c, "update public.profiles set created_at = '2000-01-01T00:00:00Z' where id = $1", [id]);
  return id;
}

describe("users service — reads", () => {
  it("lists and gets a user; a missing id is not_found", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, {
        email: email("list"),
        displayName: "List Me",
      });

      const list = await listUsers(deps(c), { q: "List Me", limit: 10, offset: 0 });
      expect(list.users.some((user) => user.id === id)).toBe(true);
      expect(list.total).toBeGreaterThanOrEqual(1);

      const user = await getUser(deps(c), id);
      expect(user.display_name).toBe("List Me");

      await expect(getUser(deps(c), crypto.randomUUID())).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("counts only active profiles in active_total, across every page", async () => {
    await inRollback(async (c) => {
      const prefix = `Active ${Date.now()}-${Math.random()}`;
      await createTestUser(c, { email: email("active-one"), displayName: `${prefix} One` });
      await createTestUser(c, { email: email("active-two"), displayName: `${prefix} Two` });
      const deactivated = await createTestUser(c, {
        email: email("active-off"),
        displayName: `${prefix} Off`,
      });
      await query(c, "update public.profiles set deactivated_at = now() where id = $1", [
        deactivated.id,
      ]);

      const list = await listUsers(deps(c), { q: prefix, limit: 2, offset: 0 });

      expect(list.total).toBe(3);
      expect(list.active_total).toBe(2);
      expect(list.users).toHaveLength(2);
    });
  });
});

describe("users service — profile and role edits", () => {
  it("updates profile fields", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("profile") });

      const updated = await updateUser(deps(c), caller("admin"), id, {
        display_name: "New Name",
        locale: "es",
        timezone: "Europe/Madrid",
      });

      expect(updated.display_name).toBe("New Name");
      expect(updated.locale).toBe("es");
      expect(updated.timezone).toBe("Europe/Madrid");
    });
  });

  it("lets an admin promote to admin but never to super_admin", async () => {
    await inRollback(async (c) => {
      const first = await createTestUser(c, { email: email("promote-admin") });
      const promoted = await updateUser(deps(c), caller("admin"), first.id, { role: "admin" });
      expect(promoted.role).toBe("admin");

      const second = await createTestUser(c, { email: email("promote-super") });
      await expect(
        updateUser(deps(c), caller("admin"), second.id, { role: "super_admin" }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });

  it("lets a super_admin promote a user", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("super-promote") });
      const updated = await updateUser(deps(c), caller("super_admin"), id, { role: "admin" });
      expect(updated.role).toBe("admin");
    });
  });

  it("never demotes the root super_admin", async () => {
    await inRollback(async (c) => {
      const rootId = await makeRootSuperAdmin(c, "Root");

      await expect(
        updateUser(deps(c), caller("super_admin"), rootId, { role: "admin" }),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("rejects changing your own role even as super_admin", async () => {
    await inRollback(async (c) => {
      await makeRootSuperAdmin(c, "Root Self Role");
      const self = await createTestUser(c, { email: email("self-role"), role: "super_admin" });
      const selfCaller: Caller = {
        kind: "session",
        userId: self.id,
        role: "super_admin",
      };

      await expect(
        updateUser(deps(c), selfCaller, self.id, { role: "admin" }),
      ).rejects.toMatchObject({
        code: "conflict",
        message: "You cannot change your own role",
      });

      const { rows } = await query(c, "select role from public.profiles where id = $1", [
        self.id,
      ]);
      expect(rows).toEqual([{ role: "super_admin" }]);
    });
  });
});

describe("users service — deactivation", () => {
  it("deactivates a regular user", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("deactivate") });

      const user = await deactivateUser(deps(c), caller("super_admin"), id);

      expect(user.deactivated_at).not.toBeNull();
      const { rows } = await query(
        c,
        "select type, target from public.event_outbox where type = 'user.deactivated' and resource->>'id' = $1",
        [id],
      );
      expect(rows).toEqual([{ type: "user.deactivated", target: "admins" }]);
    });
  });

  it("rejects an admin caller and the root", async () => {
    await inRollback(async (c) => {
      const regular = await createTestUser(c, { email: email("no-admin") });
      await expect(
        deactivateUser(deps(c), caller("admin"), regular.id),
      ).rejects.toMatchObject({ code: "insufficient_scope" });

      const rootId = await makeRootSuperAdmin(c, "Root Deactivate");
      await expect(
        deactivateUser(deps(c), caller("super_admin"), rootId),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("never removes the last active super_admin", async () => {
    await inRollback(async (c) => {
      const only = await createTestUser(c, { email: email("last-super"), role: "super_admin" });
      await query(c, "update public.profiles set role = 'admin' where role = 'super_admin' and id <> $1", [
        only.id,
      ]);

      await expect(
        deactivateUser(deps(c), caller("super_admin"), only.id),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("rejects deactivating your own account even as super_admin", async () => {
    await inRollback(async (c) => {
      await makeRootSuperAdmin(c, "Root Self Deactivate");
      const self = await createTestUser(c, { email: email("self-deactivate"), role: "super_admin" });
      const selfCaller: Caller = {
        kind: "session",
        userId: self.id,
        role: "super_admin",
      };

      await expect(deactivateUser(deps(c), selfCaller, self.id)).rejects.toMatchObject({
        code: "conflict",
        message: "You cannot deactivate your own account",
      });

      const { rows } = await query(
        c,
        "select deactivated_at from public.profiles where id = $1",
        [self.id],
      );
      expect(rows).toEqual([{ deactivated_at: null }]);
    });
  });
});

describe("users service — idempotency", () => {
  it("keeps the first deactivated_at on repeated deactivation", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("idempotent") });

      const first = await deactivateUser(deps(c), caller("super_admin"), id);
      const second = await deactivateUser(deps(c), caller("super_admin"), id);

      expect(second.deactivated_at).toBe(first.deactivated_at);
    });
  });
});
