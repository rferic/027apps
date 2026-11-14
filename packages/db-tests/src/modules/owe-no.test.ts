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

/** The real OweNo package: manifest, digests, DDL and RLS as shipped. */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../owe-no");

const email = (name: string) => `oweno-${name}-${Date.now()}-${Math.random()}@test.local`;

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

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("owe-no package", () => {
  it("installs, isolates groups by membership and uninstalls", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));

      const { rows: installed } = await query(
        c,
        "select state from public.module_registry where key = 'owe-no'",
      );
      if (installed[0]) {
        await uninstallModule(
          deps(c),
          await session(c, "super_admin"),
          "owe-no",
          manifest,
          true,
        );
      }

      await installModule(deps(c), admin, manifest);
      await activateModule(deps(c), admin, "owe-no");

      // The DDL landed in the module schema, with its widgets and hooks.
      const { rows: tables } = await query(
        c,
        `select table_name from information_schema.tables
          where table_schema = 'module_owe_no' and table_type = 'BASE TABLE'
          order by table_name`,
      );
      expect(tables.map((row) => row.table_name)).toEqual([
        "owe_no_blocks",
        "owe_no_categories",
        "owe_no_groups",
        "owe_no_import_rows",
        "owe_no_imports",
        "owe_no_members",
        "owe_no_movement_shares",
        "owe_no_movements",
      ]);

      const ana = await session(c, "user");
      const luis = await session(c, "user");

      // Demo hooks (contract `demo`): seed once, clear on demand.
      const { rows: seeded } = await query(
        c,
        `select module_owe_no.seed_demo($1::jsonb) as result`,
        [JSON.stringify({ users: [{ id: ana.userId }, { id: luis.userId }] })],
      );
      expect(seeded[0].result.groups).toBe(1);
      const { rows: again } = await query(
        c,
        `select module_owe_no.seed_demo($1::jsonb) as result`,
        [JSON.stringify({ users: [{ id: ana.userId }, { id: luis.userId }] })],
      );
      expect(again[0].result.groups).toBe(0);
      const { rows: cleared } = await query(c, `select module_owe_no.clear_demo() as result`);
      expect(cleared[0].result.groups).toBe(1);

      // Ana creates a group; the creator sees it, the outsider does not.
      await impersonate(c, ana.userId);
      const { rows: group } = await query(
        c,
        `insert into module_owe_no.owe_no_groups (name, currency, created_by)
         values ('Casa', 'EUR', public.core_current_user_id()) returning id`,
      );
      const groupId = String(group[0].id);
      await query(
        c,
        `insert into module_owe_no.owe_no_members (group_id, user_id, display_name, state, joined_at)
         values ($1, $2, 'Ana', 'active', now())`,
        [groupId, ana.userId],
      );
      expect((await query(c, "select id from module_owe_no.owe_no_groups")).rows).toHaveLength(1);

      await impersonate(c, luis.userId);
      expect((await query(c, "select id from module_owe_no.owe_no_groups")).rows).toHaveLength(0);
      // An outsider cannot add a movement either.
      await expect(
        query(
          c,
          `insert into module_owe_no.owe_no_movements
             (group_id, kind, description, amount_minor, currency, paid_by_member_id, occurred_on)
           values ($1, 'expense', 'Compra', 1000, 'EUR', $1, current_date)`,
          [groupId],
        ),
      ).rejects.toThrow();
    });
  });
});
