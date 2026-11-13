import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  deactivateModule,
  installModule,
  uninstallModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const UP = "create table items (id uuid primary key default gen_random_uuid());";
const DOWN = "drop table if exists items;";

const email = (name: string) => `dep-${name}-${Date.now()}-${Math.random()}@test.local`;

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
    readFile: async (path) =>
      path.endsWith(".svg")
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>'
        : "# Module",
  };
}

function manifest(
  key: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    key,
    name: key,
    branding: { description: key, icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    is_public: false,
    migrations: [
      { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
    ],
    settings: [],
    i18n: ["en"],
    scopes: [],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    dashboard_widgets: [],
    docs: { readme: "README.md" },
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

describe("module dependencies", () => {
  it("requires the dependency before install and activation", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const child = manifest("child-module", {
        requires: [{ key: "parent-module", version: "1.0.0" }],
      });

      await expect(installModule(deps(c), admin, child)).rejects.toMatchObject({
        details: { code: "missing_dependency" },
      });

      await installModule(deps(c), admin, manifest("parent-module"));
      await installModule(deps(c), admin, child);

      // Installed but not active is not enough to activate the child.
      await expect(activateModule(deps(c), admin, "child-module")).rejects.toMatchObject({
        details: { code: "dependency_inactive" },
      });

      await activateModule(deps(c), admin, "parent-module");
      await activateModule(deps(c), admin, "child-module");
    });
  });

  it("refuses a version below the minimum", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest("parent-module"));
      await expect(
        installModule(
          deps(c),
          admin,
          manifest("child-module", {
            requires: [{ key: "parent-module", version: "2.0.0" }],
          }),
        ),
      ).rejects.toMatchObject({ details: { code: "dependency_version" } });
    });
  });

  it("refuses to deactivate or uninstall a module another one requires", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const root = await session(c, "super_admin");
      const parent = manifest("parent-module");
      const child = manifest("child-module", {
        requires: [{ key: "parent-module", version: "1.0.0" }],
      });
      await installModule(deps(c), admin, parent);
      await installModule(deps(c), admin, child);
      await activateModule(deps(c), admin, "parent-module");
      await activateModule(deps(c), admin, "child-module");

      await expect(deactivateModule(deps(c), admin, "parent-module")).rejects.toMatchObject({
        details: { code: "required_by_module", key: "child-module" },
      });
      await expect(
        uninstallModule(deps(c), root, "parent-module", parent, true),
      ).rejects.toMatchObject({ details: { code: "required_by_module" } });

      // Once the child is gone, the parent is free again.
      await uninstallModule(deps(c), root, "child-module", child, true);
      await deactivateModule(deps(c), admin, "parent-module");
    });
  });
});
