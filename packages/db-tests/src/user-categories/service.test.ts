import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  addMember,
  assignModule,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  removeMember,
  renameCategory,
  unassignModule,
} from "@027apps/core/user-categories/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const deps = (c: ClientBase) => ({
  db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
});

const email = (name: string) => `cat-${name}-${Date.now()}-${Math.random()}@test.local`;

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

async function admin(c: ClientBase): Promise<Caller> {
  const { id } = await createTestUser(c, { email: email("admin"), role: "super_admin" });
  return { kind: "session", userId: id, role: "super_admin" };
}

async function user(c: ClientBase, name: string): Promise<{ id: string }> {
  return createTestUser(c, { email: email(name), displayName: name });
}

describe("user categories service", () => {
  it("creates, lists, gets, renames and deletes a category", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const created = await createCategory(deps(c), who, { name: "Familia" });
      expect(created.slug).toBe("familia");
      expect(created.member_count).toBe(0);

      const list = await listCategories(deps(c));
      expect(list.some((category) => category.id === created.id)).toBe(true);

      const renamed = await renameCategory(deps(c), created.id, "Casa");
      expect(renamed.name).toBe("Casa");

      await deleteCategory(deps(c), created.id);
      await expect(getCategory(deps(c), created.id)).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("adds and removes members", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const member = await user(c, "Member A");
      const category = await createCategory(deps(c), who, { name: "Amigos" });

      await addMember(deps(c), category.id, member.id);
      expect((await getCategory(deps(c), category.id)).member_count).toBe(1);

      await removeMember(deps(c), category.id, member.id);
      expect((await getCategory(deps(c), category.id)).member_count).toBe(0);
    });
  });

  it("assigns a module by materialising user_modules for current members only", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const first = await user(c, "First");
      const second = await user(c, "Second");
      const category = await createCategory(deps(c), who, { name: "Lote" });
      await addMember(deps(c), category.id, first.id);
      await addMember(deps(c), category.id, second.id);

      await assignModule(deps(c), who, category.id, "expenses");
      const { rows } = await query(
        c,
        "select user_id, revoked_at from public.user_modules where module_key = 'expenses'",
      );
      expect(rows.map((row) => String(row.user_id)).sort()).toEqual([first.id, second.id].sort());

      const late = await user(c, "Late");
      await addMember(deps(c), category.id, late.id);
      const { rows: lateRows } = await query(
        c,
        "select 1 from public.user_modules where module_key = 'expenses' and user_id = $1",
        [late.id],
      );
      expect(lateRows).toHaveLength(0);
    });
  });

  it("never revives a revoked grant and unassign does not revoke", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const member = await user(c, "Revoked");
      const category = await createCategory(deps(c), who, { name: "Revocar" });
      await addMember(deps(c), category.id, member.id);

      await assignModule(deps(c), who, category.id, "expenses");
      await query(c, "update public.user_modules set revoked_at = now() where user_id = $1", [member.id]);

      await unassignModule(deps(c), category.id, "expenses");
      const { rows: kept } = await query(c, "select 1 from public.user_modules where user_id = $1", [
        member.id,
      ]);
      expect(kept).toHaveLength(1);

      await assignModule(deps(c), who, category.id, "expenses");
      const { rows: revoked } = await query(
        c,
        "select revoked_at from public.user_modules where user_id = $1 and module_key = 'expenses'",
        [member.id],
      );
      expect(revoked[0]?.revoked_at).not.toBeNull();
    });
  });

  it("refuses to delete a category that still has modules", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const category = await createCategory(deps(c), who, { name: "Con Modulos" });
      await assignModule(deps(c), who, category.id, "expenses");

      await expect(deleteCategory(deps(c), category.id)).rejects.toMatchObject({ code: "conflict" });
    });
  });
});
