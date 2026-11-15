import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, impersonate, impersonateAnon, query, withClient } from "../pg.js";
import {
  activateModule,
  deactivateModule,
  grantUserModule,
  installModule,
  moduleScopesForCaller,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { purgeUser } from "@027apps/core/users/service.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const MODULE = "runtime-module";
const SCHEMA = "module_runtime_module";

const email = (name: string) => `runtime-${name}-${Date.now()}-${Math.random()}@test.local`;

const UP = `
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  body text not null
);
alter table notes enable row level security;
create policy notes_own on notes
  for all
  using (user_id = public.core_current_user_id())
  with check (user_id = public.core_current_user_id());
`;
const DOWN = "drop table if exists notes;";

const BAD_FK_UP = `
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  body text not null
);
`;
const BAD_FK_DOWN = "drop table if exists notes;";

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

function deps(c: ClientBase, overrides: Partial<ModulesDeps> = {}): ModulesDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  const withTransaction = async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
    // Mirror the production runner: a failed install rolls back on its own
    // without killing the surrounding test transaction.
    await c.query("savepoint module_install");
    try {
      const result = await fn(db);
      await c.query("release savepoint module_install");
      return result;
    } catch (error) {
      await c.query("rollback to savepoint module_install");
      throw error;
    }
  };
  return {
    db,
    withTransaction,
    moduleRoot: (key) => `/modules/${key}`,
    readFile: async (path) => {
      if (path.endsWith("README.md")) return "# Runtime module";
      if (path.endsWith("assets/icon.svg")) {
        return '<svg xmlns="http://www.w3.org/2000/svg"><path fill="currentColor"/></svg>';
      }
      if (path.endsWith("docs/api.md")) return "notes:read";
      throw new Error(`missing ${path}`);
    },
    ...overrides,
  };
}

function manifest(up = UP, down = DOWN, overrides: Record<string, unknown> = {}) {
  return {
    key: MODULE,
    name: "Runtime",
    branding: { description: "Runtime module", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    contract: 1,
    is_public: false,
    migrations: [
      { version: "1.0.0", up, down, digest: sha256(up), down_digest: sha256(down) },
    ],
    settings: [],
    i18n: ["en"],
    scopes: ["notes:read"],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    docs: { readme: "README.md", api: "docs/api.md" },
    ...overrides,
  };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("module runtime", () => {
  it("grants the API roles, isolates rows with the identity helper and keeps FKs safe on purge", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());

      const ana = await session(c, "user");
      const luis = await session(c, "user");

      await impersonate(c, ana.userId);
      await query(c, "insert into module_runtime_module.notes (user_id, body) values ($1, 'ana')", [ana.userId]);
      const own = await query(c, "select body from module_runtime_module.notes");
      expect(own.rows).toHaveLength(1);

      // Another user sees nothing, and cannot write a row for someone else.
      await impersonate(c, luis.userId);
      expect((await query(c, "select body from module_runtime_module.notes")).rows).toHaveLength(0);
      // An expected failure aborts the transaction: isolate it in a savepoint.
      await c.query("savepoint spoof");
      await expect(
        query(c, "insert into module_runtime_module.notes (user_id, body) values ($1, 'spoof')", [ana.userId]),
      ).rejects.toThrow();
      await c.query("rollback to savepoint spoof");
      await query(c, "insert into module_runtime_module.notes (user_id, body) values ($1, 'luis')", [luis.userId]);

      // Anon has no usage on the module schema.
      await impersonateAnon(c);
      await c.query("savepoint anon");
      await expect(query(c, "select body from module_runtime_module.notes")).rejects.toThrow(/permission denied/i);
      await c.query("rollback to savepoint anon");

      // Purging a user keeps the row and nulls the reference (D16).
      await c.query("reset role");
      await c.query("update public.profiles set deactivated_at = now() where id = $1", [ana.userId]);
      // No `withTransaction`: `withRoleLock` opens its own BEGIN/COMMIT, which
      // would commit this test's outer transaction. Without it the purge runs
      // in place, which is what this FK assertion needs.
      await purgeUser(
        { db: { query: (sql, params = []) => query(c, sql, params) } },
        await session(c, "super_admin"),
        ana.userId,
      );
      const { rows } = await query(c, "select body, user_id from module_runtime_module.notes order by body");
      expect(rows).toEqual([
        { body: "ana", user_id: null },
        { body: "luis", user_id: luis.userId },
      ]);
    });
  });

  it("resolves module scopes only for callers with access", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());
      await activateModule(deps(c), admin, MODULE);

      const user = await session(c, "user");
      // No grant yet, and the module is private.
      expect(await moduleScopesForCaller(deps(c), user, MODULE)).toBeNull();

      await grantUserModule(deps(c), admin, user.userId, MODULE);
      expect(await moduleScopesForCaller(deps(c), user, MODULE)).toEqual(["notes:read"]);

      // An admin sees every active module without a grant.
      expect(await moduleScopesForCaller(deps(c), admin, MODULE)).toEqual(["notes:read"]);

      // A disabled module exposes nothing, not even to an admin.
      await deactivateModule(deps(c), admin, MODULE);
      expect(await moduleScopesForCaller(deps(c), user, MODULE)).toBeNull();
      expect(await moduleScopesForCaller(deps(c), admin, MODULE)).toBeNull();

      // Unknown keys answer the same null, never a different error.
      expect(await moduleScopesForCaller(deps(c), admin, "missing-module")).toBeNull();
    });
  });

  it("rejects a profiles foreign key without on delete set null", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await expect(
        installModule(deps(c), admin, manifest(BAD_FK_UP, BAD_FK_DOWN)),
      ).rejects.toMatchObject({ code: "validation_failed" });
      const { rows } = await query(
        c,
        "select 1 from pg_namespace where nspname = $1",
        [SCHEMA],
      );
      // The failed install rolled back: no schema is left behind.
      expect(rows).toHaveLength(0);
    });
  });

  it("drops the schema and its grants on uninstall", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());
      const superAdmin = await session(c, "super_admin");
      await uninstallModule(deps(c), superAdmin, MODULE, manifest(), true);
      const { rows } = await query(c, "select 1 from pg_namespace where nspname = $1", [SCHEMA]);
      expect(rows).toHaveLength(0);
    });
  });
});
