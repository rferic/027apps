import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import { withClient, query, count, impersonate, impersonateAnon, createTestUser, createTestModule } from "../pg.js";

/**
 * RLS isolation for user categories (core-data-model §5, decision B4):
 * a member only reads their own label and their own module grants; admins
 * manage everything; anon has no privileges at all.
 */

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seedUser(c: ClientBase, role: "super_admin" | "admin" | "user", name: string) {
  return createTestUser(c, {
    email: `rls-cat-${name}-${uniq()}@test.local`,
    displayName: name,
    role,
  });
}

async function seedCategory(c: ClientBase, createdBy: string, name: string): Promise<string> {
  const { rows } = await query(
    c,
    `insert into public.user_categories (name, slug, created_by)
     values ($1, $2, $3) returning id`,
    [name, `${name.toLowerCase()}-${uniq()}`, createdBy],
  );
  return String(rows[0]!.id);
}

describe("RLS: user categories", () => {
  it("a member reads only their own category label", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Admin");
      const member = await seedUser(c, "user", "RLS Member");
      const mine = await seedCategory(c, admin.id, "Familia");
      const theirs = await seedCategory(c, admin.id, "Amigos");
      await query(
        c,
        "insert into public.user_category_members (user_category_id, user_id) values ($1, $2)",
        [mine, member.id],
      );

      await impersonate(c, member.id);
      await expect(
        count(c, "select count(*) from public.user_categories where id = $1", [mine]),
      ).resolves.toBe(1);
      await expect(
        count(c, "select count(*) from public.user_categories where id = $1", [theirs]),
      ).resolves.toBe(0);
      await c.query("ROLLBACK");
    });
  });

  it("a plain user cannot create, rename, delete or join a category", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Admin 2");
      const plain = await seedUser(c, "user", "RLS Plain");
      const category = await seedCategory(c, admin.id, "Casa");

      await impersonate(c, plain.id);

      await c.query("SAVEPOINT sp_create");
      await expect(
        query(c, "insert into public.user_categories (name, slug, created_by) values ($1, $2, $3)", [
          "Intruso",
          `intruso-${uniq()}`,
          plain.id,
        ]),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_create");

      await expect(
        count(c, "update public.user_categories set name = 'Hackeada' where id = $1 returning 1", [
          category,
        ]),
      ).resolves.toBe(0);
      await expect(
        count(c, "delete from public.user_categories where id = $1 returning 1", [category]),
      ).resolves.toBe(0);

      await c.query("SAVEPOINT sp_join");
      await expect(
        query(
          c,
          "insert into public.user_category_members (user_category_id, user_id) values ($1, $2)",
          [category, plain.id],
        ),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_join");

      await c.query("ROLLBACK");
    });
  });

  it("a user reads only their own module grants and cannot grant themselves one", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Admin 3");
      const owner = await seedUser(c, "user", "RLS Owner");
      const other = await seedUser(c, "user", "RLS Other");
      await query(
        c,
        `insert into public.user_modules (user_id, module_key, granted_by)
         values ($1, 'expenses', $2), ($3, 'expenses', $2)`,
        [owner.id, admin.id, other.id],
      );

      await impersonate(c, owner.id);
      await expect(
        count(c, "select count(*) from public.user_modules where user_id = $1", [owner.id]),
      ).resolves.toBe(1);
      await expect(
        count(c, "select count(*) from public.user_modules where user_id = $1", [other.id]),
      ).resolves.toBe(0);

      await c.query("SAVEPOINT sp_grant");
      await expect(
        query(
          c,
          "insert into public.user_modules (user_id, module_key, granted_by) values ($1, 'balances', $1)",
          [owner.id],
        ),
      ).rejects.toThrowError(/row-level security|permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_grant");

      await c.query("ROLLBACK");
    });
  });

  it("an admin manages categories and reads every grant", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      const admin = await seedUser(c, "admin", "RLS Admin 4");
      const member = await seedUser(c, "user", "RLS Member 4");
      const category = await seedCategory(c, admin.id, "Trabajo");
      await query(
        c,
        "insert into public.user_modules (user_id, module_key, granted_by) values ($1, 'expenses', $2)",
        [member.id, admin.id],
      );

      await impersonate(c, admin.id);
      await expect(count(c, "select count(*) from public.user_categories")).resolves.toBe(1);
      await expect(count(c, "select count(*) from public.user_modules")).resolves.toBe(1);
      await expect(
        query(c, "update public.user_categories set name = 'Oficina' where id = $1 returning id", [
          category,
        ]),
      ).resolves.toMatchObject({ rows: [{ id: category }] });
      await c.query("ROLLBACK");
    });
  });

  it("anon has no privileges on the category tables", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await createTestModule(c, "expenses");
      await createTestModule(c, "balances");
      await impersonateAnon(c);
      await expect(query(c, "select count(*) from public.user_categories")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
  });
});
