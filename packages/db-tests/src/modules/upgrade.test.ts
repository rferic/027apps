import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  upgradeModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const UP1 = "create table items (id uuid primary key default gen_random_uuid(), name text not null);";
const DOWN1 = "drop table if exists items;";
const UP2 = "alter table items add column note text;";
const DOWN2 = "alter table items drop column note;";

const email = (name: string) => `up-${name}-${Date.now()}-${Math.random()}@test.local`;

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
    moduleRoot: (key) => `/modules/${key}`,
    readFile: async (path) => {
      if (path.endsWith(".svg")) {
        return '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>';
      }
      if (path.endsWith("docs/settings.md")) return "enabled limit extra";
      return "# Module";
    },
  };
}

function settings(keys: string[]) {
  return [
    {
      category: "demo_module",
      label: "Demo",
      sort_order: 10,
      settings: keys.map((key, index) => ({
        key,
        type: "bool",
        default: true,
        label: key,
        is_public: false,
        is_secret: false,
        mcp_access: "read",
        sort_order: index * 10,
      })),
    },
  ];
}

function base(overrides: Record<string, unknown> = {}) {
  return {
    key: "demo-module",
    name: "Demo",
    branding: { description: "Demo", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    contract: 1,
    is_public: false,
    migrations: [
      { version: "1.0.0", up: UP1, down: DOWN1, digest: sha256(UP1), down_digest: sha256(DOWN1) },
    ],
    settings: settings(["enabled", "limit"]),
    i18n: ["en"],
    scopes: [],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    dashboard_widgets: [],
    docs: { readme: "README.md", settings: "docs/settings.md" },
    ...overrides,
  };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("upgradeModule", () => {
  it("applies only the new migrations and keeps the data and stored values", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, base());
      await activateModule(deps(c), admin, "demo-module");
      await query(c, "insert into module_demo_module.items (name) values ('keep me')");
      await query(
        c,
        "update public.settings set value = 'false'::jsonb where category_key = 'demo_module' and key = 'demo_module.enabled'",
      );

      const upgraded = await upgradeModule(
        deps(c),
        admin,
        "demo-module",
        base({
          version: "1.1.0",
          migrations: [
            { version: "1.0.0", up: UP1, down: DOWN1, digest: sha256(UP1), down_digest: sha256(DOWN1) },
            { version: "1.1.0", up: UP2, down: DOWN2, digest: sha256(UP2), down_digest: sha256(DOWN2) },
          ],
          // `limit` disappears; `extra` is new.
          settings: settings(["enabled", "extra"]),
        }),
      );

      expect(upgraded.version).toBe("1.1.0");
      expect(upgraded.state).toBe("active");

      const { rows: migrations } = await query(
        c,
        "select version from public.module_migrations where module_key = 'demo-module' and direction = 'up' order by version",
      );
      expect(migrations.map((row) => row.version)).toEqual(["1.0.0", "1.1.0"]);

      const { rows: columns } = await query(
        c,
        "select column_name from information_schema.columns where table_schema = 'module_demo_module' and table_name = 'items'",
      );
      expect(columns.map((row) => row.column_name)).toContain("note");
      const { rows: kept } = await query(c, "select name from module_demo_module.items");
      expect(kept.map((row) => row.name)).toEqual(["keep me"]);

      const { rows: stored } = await query(
        c,
        "select key, value from public.settings where category_key = 'demo_module' order by key",
      );
      expect(stored).toEqual([
        { key: "demo_module.enabled", value: false },
        { key: "demo_module.extra", value: true },
      ]);
    });
  });

  it("refuses the same or an older version", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, base());

      await expect(
        upgradeModule(deps(c), admin, "demo-module", base({ version: "1.0.0" })),
      ).rejects.toMatchObject({ details: { code: "not_newer" } });
      await expect(
        upgradeModule(deps(c), admin, "demo-module", base({ version: "0.9.0" })),
      ).rejects.toMatchObject({ details: { code: "not_newer" } });
    });
  });
});
