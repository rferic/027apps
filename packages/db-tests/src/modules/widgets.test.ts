import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  grantUserModule,
  installModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { getDashboardWidgets } from "@027apps/core/modules/widgets.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const UP = `
create table notes (id uuid primary key default gen_random_uuid(), user_id uuid);
create function widget_data(uid uuid) returns jsonb
language sql stable
as $$ select jsonb_build_object('value', count(*), 'label', 'notes') from notes where user_id = uid; $$;
create function widget_boom(uid uuid) returns jsonb
language plpgsql
as $$ begin raise exception 'broken'; end $$;
`;
const DOWN = "drop table if exists notes cascade;";

const email = (name: string) => `wd-${name}-${Date.now()}-${Math.random()}@test.local`;

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
      path.endsWith(".svg") ? '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>' : "# Module",
  };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    key: "widget-module",
    name: "Widget",
    branding: { description: "Widget", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    contract: 1,
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
    dashboard_widgets: [
      {
        key: "demo.metric",
        type: "metric",
        surface: "panel",
        title: "Demo",
        icon: "box",
        order: 10,
        data_fn: "widget_data",
      },
    ],
    docs: { readme: "README.md" },
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

describe("dashboard widgets", () => {
  it("composes the widgets of the modules the caller can use", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest());
      await activateModule(deps(c), admin, "widget-module");

      const user = await session(c, "user");
      expect(await getDashboardWidgets(deps(c), user, "panel")).toEqual([]);

      await grantUserModule(deps(c), admin, user.userId, "widget-module");
      const widgets = await getDashboardWidgets(deps(c), user, "panel");
      expect(widgets).toEqual([
        {
          key: "demo.metric",
          type: "metric",
          surface: "panel",
          title: "Demo",
          icon: "box",
          order: 10,
          module_key: "widget-module",
          data: { value: 0, label: "notes" },
        },
      ]);

      // An admin sees it without a grant, and another surface filters it out.
      expect(await getDashboardWidgets(deps(c), admin, "panel")).toHaveLength(1);
      expect(await getDashboardWidgets(deps(c), admin, "app")).toEqual([]);
      // Anon gets nothing.
      expect(await getDashboardWidgets(deps(c), { kind: "anon" })).toEqual([]);
    });
  });

  it("omits a widget whose resolver fails", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(
        deps(c),
        admin,
        manifest({
          key: "boom-module",
          migrations: [
            {
              version: "1.0.0",
              up: UP,
              down: DOWN,
              digest: sha256(UP),
              down_digest: sha256(DOWN),
            },
          ],
          dashboard_widgets: [
            {
              key: "boom.metric",
              type: "metric",
              surface: "panel",
              title: "Boom",
              icon: "box",
              order: 10,
              data_fn: "widget_boom",
            },
          ],
        }),
      );
      await activateModule(deps(c), admin, "boom-module");

      const widgets = await getDashboardWidgets(deps(c), admin, "panel");
      expect(widgets.filter((widget) => widget.module_key === "boom-module")).toEqual([]);
    });
  });
});
