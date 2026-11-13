import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, impersonate, query, withClient } from "../pg.js";
import {
  activateModule,
  grantUserModule,
  installModule,
  moduleScopesForCaller,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { getDashboardWidgets } from "@027apps/core/modules/widgets.js";
import type { Caller } from "@027apps/core/api/types.js";

/** The real package on disk, not an inline manifest: digests, docs and guard included. */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../fixture");

const email = (name: string) => `fixture-${name}-${Date.now()}-${Math.random()}@test.local`;

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
      await c.query("savepoint module_install");
      try {
        const result = await fn(db);
        await c.query("release savepoint module_install");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint module_install");
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

describe("fixture package", () => {
  it("installs from disk, isolates notes per user and uninstalls", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const manifest = JSON.parse(await readFile(resolve(ROOT, "manifest.json"), "utf8"));

      // The developer may have the Demo installed in their local instance: this
      // test needs a clean slate, and the surrounding transaction restores it.
      const { rows: installed } = await query(
        c,
        "select state from public.module_registry where key = 'fixture'",
      );
      if (installed[0]) {
        const superAdmin = await session(c, "super_admin");
        await uninstallModule(deps(c), superAdmin, "fixture", manifest, true);
      }

      await installModule(deps(c), admin, manifest);
      await activateModule(deps(c), admin, "fixture");

      const ana = await session(c, "user");
      const luis = await session(c, "user");

      expect(await moduleScopesForCaller(deps(c), ana, "fixture")).toBeNull();
      await grantUserModule(deps(c), admin, ana.userId, "fixture");
      expect(await moduleScopesForCaller(deps(c), ana, "fixture")).toEqual([
        "notes:read",
        "notes:write",
      ]);

      await impersonate(c, ana.userId);
      await query(c, "insert into module_fixture.notes (user_id, body) values ($1, 'ana')", [
        ana.userId,
      ]);
      expect((await query(c, "select body from module_fixture.notes")).rows).toHaveLength(1);

      await impersonate(c, luis.userId);
      expect((await query(c, "select body from module_fixture.notes")).rows).toHaveLength(0);

      await c.query("reset role");

      // 1.3.0 adds a widget: the manifest, the registry and the function agree.
      expect(await getDashboardWidgets(deps(c), ana, "panel")).toEqual([
        {
          key: "fixture.notes",
          type: "metric",
          surface: "panel",
          title: "Your notes",
          icon: "note",
          order: 90,
          module_key: "fixture",
          data: { value: 1, label: "notes", detail: "owned by you" },
        },
      ]);

      const superAdmin = await session(c, "super_admin");
      await uninstallModule(deps(c), superAdmin, "fixture", manifest, true);
      const { rows } = await query(c, "select 1 from pg_namespace where nspname = 'module_fixture'");
      expect(rows).toHaveLength(0);
    });
  });
});
