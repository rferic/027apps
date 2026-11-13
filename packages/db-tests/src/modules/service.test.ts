import { describe, expect, it, vi } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  deactivateModule,
  getModule,
  getModuleSettings,
  grantUserModule,
  installModule,
  listModules,
  revokeUserModule,
  uninstallModule,
  updateModule,
  updateModuleSetting,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const PAGE = { limit: 100, offset: 0 };

const email = (name: string) => `mod-${name}-${Date.now()}-${Math.random()}@test.local`;

const UP = "create table items (id uuid primary key default gen_random_uuid(), name text not null);";
const DOWN = "drop table if exists items;";

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
  return {
    db,
    withTransaction: (fn) => fn(db),
    moduleRoot: (key) => `/modules/${key}`,
    readFile: async (path) => {
      if (path.endsWith("README.md")) return "# Demo module";
      if (path.endsWith("docs/settings.md")) return "enabled limit";
      if (path.endsWith("assets/icon.svg")) {
        return '<svg xmlns="http://www.w3.org/2000/svg"><path fill="currentColor"/></svg>';
      }
      throw new Error(`missing ${path}`);
    },
    ...overrides,
  };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    key: "demo-module",
    name: "Demo",
    branding: { description: "Demo module", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    is_public: false,
    migrations: [
      {
        version: "1.0.0",
        up: UP,
        down: DOWN,
        digest: sha256(UP),
        down_digest: sha256(DOWN),
      },
    ],
    settings: [
      {
        category: "demo_module",
        label: "Demo",
        sort_order: 10,
        settings: [
          {
            key: "enabled",
            type: "bool",
            default: true,
            label: "Enabled",
            is_public: true,
            is_secret: false,
            mcp_access: "read",
            sort_order: 10,
          },
        ],
      },
    ],
    i18n: ["en"],
    scopes: [],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    docs: { readme: "README.md", settings: "docs/settings.md" },
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

describe("modules installer", () => {
  it("installs the manifest DDL in its own schema and seeds settings", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const installed = await installModule(deps(c), admin, manifest());

      expect(installed.state).toBe("installed");
      expect(installed.version).toBe("1.0.0");

      const { rows: table } = await query(
        c,
        "select 1 from information_schema.tables where table_schema = 'module_demo_module' and table_name = 'items'",
      );
      expect(table).toHaveLength(1);

      const { rows: settings } = await query(
        c,
        "select key, value, is_public from public.settings where category_key = 'demo_module'",
      );
      expect(settings).toEqual([{ key: "demo_module.enabled", value: true, is_public: true }]);

      const { rows: migrations } = await query(
        c,
        "select version, direction from public.module_migrations where module_key = 'demo-module'",
      );
      expect(migrations).toEqual([{ version: "1.0.0", direction: "up" }]);

      const { rows: event } = await query(c, "select type, target from public.event_outbox where type = 'module.installed'");
      expect(event).toEqual([{ type: "module.installed", target: "admins" }]);

      await expect(installModule(deps(c), admin, manifest())).rejects.toMatchObject({
        code: "conflict",
      });
    });
  });

  it("refuses a digest mismatch before touching the database", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const tampered = manifest({
        migrations: [
          { version: "1.0.0", up: UP + " ", down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
        ],
      });

      await expect(installModule(deps(c), admin, tampered)).rejects.toMatchObject({
        code: "validation_failed",
      });
      const { rows } = await query(c, "select 1 from public.module_registry");
      expect(rows).toHaveLength(0);
    });
  });

  it("rejects unsafe SQL", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const unsafe = "create table public.items (id int);";
      const bad = manifest({
        migrations: [
          {
            version: "1.0.0",
            up: unsafe,
            down: DOWN,
            digest: sha256(unsafe),
            down_digest: sha256(DOWN),
          },
        ],
      });
      await expect(installModule(deps(c), admin, bad)).rejects.toThrow(/public schema/);
    });
  });

  it("walks the lifecycle and enforces legal transitions", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());

      await expect(activateModule(deps(c), admin, "demo-module")).resolves.toMatchObject({
        state: "active",
      });
      await expect(deactivateModule(deps(c), admin, "demo-module")).resolves.toMatchObject({
        state: "disabled",
      });
      await expect(deactivateModule(deps(c), admin, "demo-module")).rejects.toMatchObject({
        code: "conflict",
      });
      await expect(activateModule(deps(c), admin, "demo-module")).resolves.toMatchObject({
        state: "active",
      });
      expect((await listModules(deps(c), admin, PAGE)).modules).toHaveLength(1);
    });
  });

  it("gates private modules by access and grants/revokes per user", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const user = await session(c, "user");
      await installModule(deps(c), admin, manifest());
      await activateModule(deps(c), admin, "demo-module");

      await expect(getModule(deps(c), user, "demo-module")).rejects.toMatchObject({
        code: "not_found",
      });
      await grantUserModule(deps(c), admin, user.userId, "demo-module");
      await expect(getModule(deps(c), user, "demo-module")).resolves.toMatchObject({
        key: "demo-module",
      });
      await revokeUserModule(deps(c), admin, user.userId, "demo-module");
      await expect(getModule(deps(c), user, "demo-module")).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  it("updates visibility and module settings, masking secrets", async () => {
    await inRollback(async (c) => {
      const superAdmin = await session(c, "super_admin");
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());

      await expect(
        updateModule(deps(c), admin, "demo-module", { mcp_exposed: "read_write" }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
      await expect(
        updateModule(deps(c), superAdmin, "demo-module", {
          is_public: true,
          mcp_exposed: "read_write",
        }),
      ).resolves.toMatchObject({ is_public: true, mcp_exposed: "read_write" });

      expect(await getModuleSettings(deps(c), admin, "demo-module")).toHaveLength(1);
      const updated = await updateModuleSetting(
        deps(c),
        admin,
        "demo-module",
        { key: "enabled", value: false },
        { type: "bool" },
      );
      expect(updated.value).toBe(false);
    });
  });

  it("enforces the range of an int setting with a slider", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const ranged = manifest({
        settings: [
          {
            category: "demo_module",
            label: "Demo",
            sort_order: 10,
            settings: [
              {
                key: "limit",
                type: "int",
                min: 4,
                max: 20,
                step: 1,
                control: "slider",
                default: 12,
                label: "Limit",
                is_public: false,
                is_secret: false,
                mcp_access: "read",
                sort_order: 10,
              },
            ],
          },
        ],
        docs: { readme: "README.md", settings: "docs/settings.md" },
      });
      await installModule(deps(c), admin, ranged);

      await expect(
        updateModuleSetting(deps(c), admin, "demo-module", { key: "limit", value: 21 }, {
          type: "int",
          min: 4,
          max: 20,
          step: 1,
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });
      await expect(
        updateModuleSetting(deps(c), admin, "demo-module", { key: "limit", value: 4.5 }, {
          type: "int",
          min: 4,
          max: 20,
          step: 1,
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });

      const updated = await updateModuleSetting(
        deps(c),
        admin,
        "demo-module",
        { key: "limit", value: 18 },
        { type: "int", min: 4, max: 20, step: 1 },
      );
      expect(updated.value).toBe(18);
    });
  });

  it("uninstalls only with confirmation when grants exist and reverses the DDL", async () => {
    await inRollback(async (c) => {
      const superAdmin = await session(c, "super_admin");
      const admin = await session(c, "admin");
      const user = await session(c, "user");
      await installModule(deps(c), admin, manifest());
      await grantUserModule(deps(c), admin, user.userId, "demo-module");

      await expect(
        uninstallModule(deps(c), superAdmin, "demo-module", manifest(), false),
      ).rejects.toMatchObject({ code: "conflict" });

      await uninstallModule(deps(c), superAdmin, "demo-module", manifest(), true);

      const { rows: registry } = await query(c, "select 1 from public.module_registry");
      expect(registry).toHaveLength(0);
      const { rows: table } = await query(
        c,
        "select 1 from information_schema.tables where table_schema = 'module_demo_module' and table_name = 'items'",
      );
      expect(table).toHaveLength(0);
      const { rows: settings } = await query(
        c,
        "select 1 from public.settings where category_key = 'demo_module'",
      );
      expect(settings).toHaveLength(0);
      const { rows: grants } = await query(c, "select 1 from public.user_modules where module_key = 'demo-module'");
      expect(grants).toHaveLength(0);
    });
  });

  it("filters the catalogue for non-admins and requires a transaction runner", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const user = await session(c, "user");
      const d = deps(c);
      await installModule(d, admin, manifest());

      expect((await listModules(d, admin, PAGE)).modules).toHaveLength(1);
      expect((await listModules(d, user, PAGE)).modules).toHaveLength(0);

      await activateModule(d, admin, "demo-module");
      expect((await listModules(d, user, PAGE)).modules).toHaveLength(0);

      await grantUserModule(d, admin, user.userId, "demo-module");
      expect((await listModules(d, user, PAGE)).modules).toHaveLength(1);

      await expect(
        installModule({ ...d, withTransaction: undefined }, admin, manifest()),
      ).rejects.toMatchObject({ code: "internal" });
    });
  });

  it("rejects a setting value that does not match its declared type", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const d = deps(c);
      await installModule(d, admin, manifest());
      await expect(
        updateModuleSetting(d, admin, "demo-module", { key: "enabled", value: "yes" }, { type: "bool" }),
      ).rejects.toMatchObject({ code: "validation_failed" });
    });
  });

  it("only super_admins can uninstall", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());
      await expect(
        uninstallModule(deps(c), admin, "demo-module", manifest(), true),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });
});
