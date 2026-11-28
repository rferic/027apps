import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, impersonate, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import type { Caller } from "@027apps/core/api/types.js";

/** The real Tareas package: manifest, digests, DDL and RLS as shipped. */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../todo");

const email = (name: string) => `todo-${name}-${Date.now()}-${Math.random()}@test.local`;

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

function deps(c: ClientBase): ModulesDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint module_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint module_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint module_op");
        throw error;
      }
    },
    moduleRoot: () => ROOT,
    readFile: (path) => readFile(path, "utf8"),
  };
}

/** A statement that must fail: the savepoint keeps the transaction usable. */
async function rejected(c: ClientBase, sql: string, params: unknown[] = []): Promise<string> {
  await c.query("savepoint expect_fail");
  try {
    await query(c, sql, params);
    await c.query("release savepoint expect_fail");
    return "";
  } catch (error) {
    await c.query("rollback to savepoint expect_fail");
    return (error as Error).message;
  }
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("todo package", () => {
  it("installs the schema with RLS and isolates groups by membership", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      // Every session is created before impersonating: `authenticated` cannot
      // insert into auth.users.
      const root = await session(c, "super_admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));

      const { rows: installed } = await query(
        c,
        "select state from public.module_registry where key = 'todo'",
      );
      if (installed[0]) {
        await uninstallModule(deps(c), root, "todo", manifest, true);
      }

      await installModule(deps(c), admin, manifest);
      await activateModule(deps(c), admin, "todo");

      // The DDL landed in the module schema.
      const { rows: tables } = await query(
        c,
        `select table_name from information_schema.tables
          where table_schema = 'module_todo' and table_type = 'BASE TABLE'
          order by table_name`,
      );
      expect(tables.map((row) => row.table_name)).toEqual([
        "todo_categories",
        "todo_group_members",
        "todo_groups",
        "todo_idempotency",
        "todo_power_totals",
        "todo_requests",
        "todo_season_results",
        "todo_seasons",
        "todo_task_occurrences",
        "todo_tasks",
      ]);

      // Every table is protected, and the instance settings were seeded.
      const { rows: rls } = await query(
        c,
        `select tablename from pg_tables
          where schemaname = 'module_todo' and rowsecurity
          order by tablename`,
      );
      expect(rls).toHaveLength(10);
      const { rows: settings } = await query(
        c,
        "select key from public.settings where key like 'todo.%' order by key",
      );
      expect(settings.map((row) => row.key)).toEqual([
        "todo.default_power",
        "todo.request_ttl_hours",
      ]);

      const ana = await session(c, "user");
      const luis = await session(c, "user");

      // Seeded as the owner would: the API writes with service_role.
      const { rows: group } = await query(
        c,
        `insert into module_todo.todo_groups (name, owner_id)
         values ('🏠 Casa', $1) returning id`,
        [ana.userId],
      );
      const groupId = group[0]?.id as string;
      await query(
        c,
        `insert into module_todo.todo_group_members (group_id, user_id, role)
         values ($1, $2, 'owner')`,
        [groupId, ana.userId],
      );
      await query(
        c,
        `insert into module_todo.todo_tasks (group_id, title, created_by)
         values ($1, '🧾 Pagar la comunidad', $2)`,
        [groupId, ana.userId],
      );

      // A member reads their group; writing directly is refused (SELECT-only RLS).
      await impersonate(c, ana.userId!);
      const mine = await query(c, "select id from module_todo.todo_tasks");
      expect(mine.rows).toHaveLength(1);
      expect(
        await rejected(
          c,
          "insert into module_todo.todo_groups (name, owner_id) values ('Otra', $1)",
          [ana.userId],
        ),
      ).toMatch(/row-level security/i);

      // A stranger sees nothing, and the personal folder is per user.
      await impersonate(c, luis.userId!);
      const theirs = await query(c, "select id from module_todo.todo_tasks");
      expect(theirs.rows).toHaveLength(0);

      // Back to the owning role: uninstall drops the schema.
      await c.query("RESET ROLE");
      await uninstallModule(deps(c), root, "todo", manifest, true);
      const { rows: gone } = await query(
        c,
        "select 1 from information_schema.schemata where schema_name = 'module_todo'",
      );
      expect(gone).toHaveLength(0);
    });
  });
});
