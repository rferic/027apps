import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestModule, createTestUser, query, withClient } from "../pg.js";
import { listModuleGrants, type ModulesDeps } from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const MODULE = "grants-module";

const admin: Caller = { kind: "session", userId: crypto.randomUUID(), role: "admin" };

const email = (name: string) => `grants-${name}-${Date.now()}-${Math.random()}@test.local`;

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    await createTestModule(c, MODULE);
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

function deps(c: ClientBase): ModulesDeps {
  return { db: { query: (sql, params = []) => query(c, sql, params) } };
}

async function createCategory(c: ClientBase, name: string, adminId: string): Promise<string> {
  const { rows } = await query(
    c,
    "insert into public.user_categories (name, slug, created_by) values ($1, $2, $3) returning id",
    [name, name.toLowerCase(), adminId],
  );
  return String(rows[0]?.id);
}

describe("listModuleGrants", () => {
  it("aggregates the active grants and the categories in one read", async () => {
    await inRollback(async (c) => {
      const adminUser = await createTestUser(c, {
        email: email("admin"),
        role: "admin",
        displayName: "Admin",
      });
      // Inserted out of order: the aggregate must sort, not the caller.
      const zoe = await createTestUser(c, {
        email: email("zoe"),
        role: "user",
        displayName: "Zoe",
      });
      const ana = await createTestUser(c, {
        email: email("ana"),
        role: "user",
        displayName: "Ana",
      });
      const bea = await createTestUser(c, {
        email: email("bea"),
        role: "user",
        displayName: "Bea",
      });

      for (const user of [zoe, ana]) {
        await query(
          c,
          "insert into public.user_modules (user_id, module_key, granted_by) values ($1, $2, $3)",
          [user.id, MODULE, adminUser.id],
        );
      }
      await query(
        c,
        `insert into public.user_modules (user_id, module_key, granted_by, revoked_at)
         values ($1, $2, $3, now())`,
        [bea.id, MODULE, adminUser.id],
      );

      const familia = await createCategory(c, "Familia", adminUser.id);
      const amigos = await createCategory(c, "Amigos", adminUser.id);
      for (const category of [familia, amigos]) {
        await query(
          c,
          `insert into public.user_category_modules
             (user_category_id, module_key, assigned_by)
           values ($1, $2, $3)`,
          [category, MODULE, adminUser.id],
        );
      }

      const grants = await listModuleGrants(deps(c), admin, MODULE);

      expect(grants.users).toEqual([
        { id: ana.id, display_name: "Ana" },
        { id: zoe.id, display_name: "Zoe" },
      ]);
      expect(grants.categories).toEqual([
        { id: amigos, name: "Amigos" },
        { id: familia, name: "Familia" },
      ]);
    });
  });

  it("returns empty arrays for a module without grants", async () => {
    await inRollback(async (c) => {
      await expect(listModuleGrants(deps(c), admin, MODULE)).resolves.toEqual({
        users: [],
        categories: [],
      });
    });
  });

  it("rejects a module that does not exist and a malformed key", async () => {
    await inRollback(async (c) => {
      await expect(listModuleGrants(deps(c), admin, "ghost-module")).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(listModuleGrants(deps(c), admin, "Not A Key")).rejects.toMatchObject({
        code: "validation_failed",
      });
    });
  });

  it("refuses a caller that is not an administrator", async () => {
    await inRollback(async (c) => {
      const user: Caller = { kind: "session", userId: crypto.randomUUID(), role: "user" };

      await expect(listModuleGrants(deps(c), user, MODULE)).rejects.toMatchObject({
        code: "insufficient_scope",
      });
    });
  });
});
