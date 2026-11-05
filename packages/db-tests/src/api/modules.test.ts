import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModuleRoute,
  deactivateModuleRoute,
  grantUserModuleRoute,
  installModuleRoute,
  moduleRoute,
  modulesRoute,
  moduleSettingsRoute,
  revokeUserModuleRoute,
  uninstallModuleRoute,
  updateModuleRoute,
  updateModuleSettingRoute,
  type ModulesRouteDeps,
} from "@027apps/core/modules/api.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const email = (name: string) => `mod-api-${name}-${Date.now()}-${Math.random()}@test.local`;
const UP = "create table items (id int primary key);";
const DOWN = "drop table if exists items;";

function demoManifest() {
  return {
    key: "demo-module",
    name: "Demo",
    branding: { description: "Demo module", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    is_public: false,
    migraciones: [
      { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
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
    eventos: [],
    admin_pages: [],
    docs: { readme: "README.md", settings: "docs/settings.md" },
  };
}

function readFile(path: string): Promise<string> {
  if (path.endsWith("README.md")) return Promise.resolve("# Demo");
  if (path.endsWith("docs/settings.md")) return Promise.resolve("enabled");
  if (path.endsWith("assets/icon.svg")) {
    return Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"><path fill="currentColor"/></svg>');
  }
  return Promise.reject(new Error(`missing ${path}`));
}

function deps(c: ClientBase, who: Caller): ModulesRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: () => {},
  };
  return {
    door,
    auth: async () => who,
    manifest: async (key) => (key === "demo-module" ? demoManifest() : null),
    modules: {
      db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
      moduleRoot: (key) => `/modules/${key}`,
      readFile,
    },
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

function post(body?: unknown): RequestInit {
  return body === undefined
    ? { method: "POST" }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("modules API", () => {
  it("requires a session or key for the catalogue", async () => {
    await inRollback(async (c) => {
      const res = await modulesRoute(deps(c, { kind: "anon" }))(new Request("http://local/api/v1/modules"));
      expect(res.status).toBe(401);
    });
  });

  it("installs as admin, activates and serves the detail to granted users", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const user = await session(c, "user");
      const adminRoute = deps(c, admin);
      const userRoute = deps(c, user);

      const installed = await installModuleRoute(adminRoute)(
        new Request("http://local/api/v1/modules/demo-module/install", post()),
        "demo-module",
      );
      expect(installed.status).toBe(201);
      expect(((await installed.json()) as { module: { state: string } }).module.state).toBe(
        "installed",
      );

      const activated = await activateModuleRoute(adminRoute)(
        new Request("http://local/api/v1/modules/demo-module/activate", post()),
        "demo-module",
      );
      expect(activated.status).toBe(200);

      const denied = await moduleRoute(userRoute)(
        new Request("http://local/api/v1/modules/demo-module"),
        "demo-module",
      );
      expect(denied.status).toBe(404);

      const granted = await grantUserModuleRoute(adminRoute)(
        new Request("http://local/api/v1/users/x/modules/demo-module", post()),
        user.userId,
        "demo-module",
      );
      expect(granted.status).toBe(204);

      const detail = await moduleRoute(userRoute)(
        new Request("http://local/api/v1/modules/demo-module"),
        "demo-module",
      );
      expect(detail.status).toBe(200);
      const body = (await detail.json()) as {
        module: { settings_public: { key: string }[] };
      };
      expect(body.module.settings_public[0]!.key).toBe("demo_module.enabled");

      const revoked = await revokeUserModuleRoute(adminRoute)(
        new Request("http://local/api/v1/users/x/modules/demo-module", { method: "DELETE" }),
        user.userId,
        "demo-module",
      );
      expect(revoked.status).toBe(204);
    });
  });

  it("updates visibility, reads and writes settings", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const route = deps(c, admin);
      await installModuleRoute(route)(
        new Request("http://local/api/v1/modules/demo-module/install", post()),
        "demo-module",
      );

      const patched = await updateModuleRoute(route)(
        new Request(
          "http://local/api/v1/modules/demo-module",
          { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_public: true }) },
        ),
        "demo-module",
      );
      expect(patched.status).toBe(200);

      const listed = await modulesRoute(route)(new Request("http://local/api/v1/modules"));
      expect(((await listed.json()) as { modules: { is_public: boolean }[] }).modules[0]!.is_public).toBe(
        true,
      );

      const settings = await moduleSettingsRoute(route)(
        new Request("http://local/api/v1/modules/demo-module/settings"),
        "demo-module",
      );
      expect(settings.status).toBe(200);

      const updated = await updateModuleSettingRoute(route)(
        new Request(
          "http://local/api/v1/modules/demo-module/settings",
          { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "enabled", value: false }) },
        ),
        "demo-module",
      );
      expect(updated.status).toBe(200);
    });
  });

  it("enforces the lifecycle permissions and manifest existence", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const superAdmin = await session(c, "super_admin");
      const user = await session(c, "user");

      const forbidden = await installModuleRoute(deps(c, user))(
        new Request("http://local/api/v1/modules/demo-module/install", post()),
        "demo-module",
      );
      expect(forbidden.status).toBe(403);

      const route = deps(c, admin);
      await installModuleRoute(route)(
        new Request("http://local/api/v1/modules/demo-module/install", post()),
        "demo-module",
      );

      const noConfirm = await uninstallModuleRoute(deps(c, superAdmin))(
        new Request("http://local/api/v1/modules/demo-module/uninstall", post({ confirm: false })),
        "demo-module",
      );
      expect(noConfirm.status).toBe(204);

      const missingManifest = await installModuleRoute(deps(c, admin))(
        new Request("http://local/api/v1/modules/other/install", post()),
        "other",
      );
      expect(missingManifest.status).toBe(404);

      const badKey = await moduleRoute(route)(
        new Request("http://local/api/v1/modules/Bad Key"),
        "Bad Key",
      );
      expect(badKey.status).toBe(400);
    });
  });
});
