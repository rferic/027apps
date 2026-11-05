import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  addCategoryMemberRoute,
  assignCategoryModuleRoute,
  createUserCategoryRoute,
  deleteUserCategoryRoute,
  unassignCategoryModuleRoute,
  userCategoriesRoute,
  userCategoryRoute,
  type UserCategoriesRouteDeps,
} from "@027apps/core/user-categories/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const door: DoorDeps = {
  rateLimitStorage: { increment: async () => ({ count: 1 }) },
  logger: () => {},
};

const email = (name: string) => `cat-api-${name}-${Date.now()}-${Math.random()}@test.local`;

function deps(c: ClientBase, who: Caller): UserCategoriesRouteDeps {
  return {
    door,
    auth: async () => who,
    categories: { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } },
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

function post(body: unknown = {}): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function adminCaller(c: ClientBase): Promise<Caller> {
  const { id } = await createTestUser(c, { email: email("admin"), role: "super_admin" });
  return { kind: "session", userId: id, role: "super_admin" };
}

describe("user-categories API", () => {
  it("requires a session and an admin", async () => {
    await inRollback(async (c) => {
      const anon = await userCategoriesRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/user-categories"),
      );
      expect(anon.status).toBe(401);

      const { id } = await createTestUser(c, { email: email("plain"), role: "user" });
      const plain = await userCategoriesRoute(deps(c, { kind: "session", userId: id, role: "user" }))(
        new Request("http://local/api/v1/user-categories"),
      );
      expect(plain.status).toBe(403);
    });
  });

  it("creates, lists, adds a member and materialises a module", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const route = deps(c, who);
      const member = await createTestUser(c, { email: email("member") });

      const created = await createUserCategoryRoute(route)(
        new Request("http://local/api/v1/user-categories", post({ name: "Familia" })),
      );
      expect(created.status).toBe(201);
      const category = ((await created.json()) as { category: { id: string; slug: string } }).category;
      expect(category.slug).toBe("familia");

      const listed = await userCategoriesRoute(route)(new Request("http://local/api/v1/user-categories"));
      expect(((await listed.json()) as { categories: unknown[] }).categories).toHaveLength(1);

      const memberRes = await addCategoryMemberRoute(route)(
        new Request("http://local/api/v1/user-categories/x/members/y", post()),
        category.id,
        member.id,
      );
      expect(memberRes.status).toBe(204);

      const assigned = await assignCategoryModuleRoute(route)(
        new Request("http://local/api/v1/user-categories/x/modules/expenses", post()),
        category.id,
        "expenses",
      );
      expect(assigned.status).toBe(200);
      expect(((await assigned.json()) as { modules: string[] }).modules).toEqual(["expenses"]);

      const detail = await userCategoryRoute(route)(
        new Request("http://local/api/v1/user-categories/x"),
        category.id,
      );
      const body = (await detail.json()) as { category: { member_count: number; modules: string[] } };
      expect(body.category.member_count).toBe(1);
      expect(body.category.modules).toEqual(["expenses"]);
    });
  });

  it("unassigns without revoking, and refuses to delete with modules", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const route = deps(c, who);
      const member = await createTestUser(c, { email: email("revoke") });

      const created = await createUserCategoryRoute(route)(
        new Request("http://local/api/v1/user-categories", post({ name: "Modulos" })),
      );
      const { id } = ((await created.json()) as { category: { id: string } }).category;
      await addCategoryMemberRoute(route)(
        new Request("http://local/api/v1/user-categories/x/members/y", post()),
        id,
        member.id,
      );
      await assignCategoryModuleRoute(route)(
        new Request("http://local/api/v1/user-categories/x/modules/expenses", post()),
        id,
        "expenses",
      );

      const deleted = await deleteUserCategoryRoute(route)(
        new Request("http://local/api/v1/user-categories/x", { method: "DELETE" }),
        id,
      );
      expect(deleted.status).toBe(409);

      const unassigned = await unassignCategoryModuleRoute(route)(
        new Request("http://local/api/v1/user-categories/x/modules/expenses", { method: "DELETE" }),
        id,
        "expenses",
      );
      expect(unassigned.status).toBe(200);
      expect(((await unassigned.json()) as { modules: string[] }).modules).toEqual([]);

      const { rows } = await query(c, "select 1 from public.user_modules where user_id = $1", [member.id]);
      expect(rows).toHaveLength(1);
    });
  });
});
