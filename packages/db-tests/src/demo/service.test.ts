import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  installModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import {
  DEMO_CATEGORY,
  DEMO_INVITATION,
  DEMO_USERS,
  clearDemo,
  demoStatus,
  seedDemo,
  type DemoDeps,
} from "@027apps/core/demo/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const email = (name: string) => `demo-${name}-${Date.now()}-${Math.random()}@test.local`;

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

function modulesDeps(c: ClientBase): ModulesDeps {
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
    moduleRoot: () => "/modules",
    readFile: async (path) =>
      path.endsWith(".svg")
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>'
        : "# Module",
  };
}

function demoDeps(
  c: ClientBase,
  env: { nodeEnv?: string; allowDemo?: string } = {},
): DemoDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint demo_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint demo_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint demo_op");
        throw error;
      }
    },
    auth: {
      async createUser(userEmail) {
        const id = randomUUID();
        await c.query(
          `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at,
                                   raw_app_meta_data, raw_user_meta_data, aud, role)
           values ($1, '00000000-0000-0000-0000-000000000000', $2, 'x', now(),
                   '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')`,
          [id, userEmail],
        );
        return { userId: id };
      },
      async deleteUser(userId) {
        await c.query("delete from auth.users where id = $1", [userId]);
      },
    },
    env,
  };
}

async function enableDemo(c: ClientBase): Promise<void> {
  await c.query(
    `insert into public.settings (category_key, key, label, value, is_secret, is_public, mcp_access, sort_order)
     values ('instance', 'demo.enabled', 'Demo data', 'true', false, false, 'none', 30)
     on conflict (category_key, key) do update set value = 'true'`,
  );
}

async function session(
  c: ClientBase,
  role: "admin" | "super_admin" = "admin",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

function manifest(overrides: Record<string, unknown> = {}) {
  const up = `
    create function seed_demo(ids jsonb) returns jsonb
    language sql as $$ select jsonb_build_object('ok', true) $$;
    create function clear_demo() returns jsonb
    language plpgsql as $$ begin raise exception 'still linked'; end $$;
  `;
  const down = "drop function if exists clear_demo(); drop function if exists seed_demo(jsonb);";
  return {
    key: "demo-blocker",
    name: "Blocker",
    branding: { description: "Blocker", icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    contract: 1,
    is_public: false,
    migrations: [
      { version: "1.0.0", up, down, digest: sha256(up), down_digest: sha256(down) },
    ],
    settings: [],
    i18n: ["en"],
    scopes: [],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    demo: { seed_fn: "seed_demo", clear_fn: "clear_demo" },
    docs: { readme: "README.md" },
    ...overrides,
  };
}

describe("demo data", () => {
  it("is refused while the setting is off or the build is production", async () => {
    await inRollback(async (c) => {
      const deps = demoDeps(c);
      expect((await demoStatus(deps)).enabled).toBe(false);
      await expect(seedDemo(deps)).rejects.toMatchObject({
        code: "insufficient_scope",
        details: { code: "demo_disabled" },
      });

      await enableDemo(c);
      const production = demoDeps(c, { nodeEnv: "production" });
      expect((await demoStatus(production)).production).toBe(true);
      await expect(seedDemo(production)).rejects.toMatchObject({
        details: { code: "demo_in_production" },
      });
      // Explicit staging opt-in.
      await expect(seedDemo(demoDeps(c, { nodeEnv: "production", allowDemo: "true" }))).resolves.toMatchObject({
        seeded: true,
      });
    });
  });

  it("seeds the dataset once, keeps it idempotent and clears it", async () => {
    await inRollback(async (c) => {
      await enableDemo(c);
      const deps = demoDeps(c);

      const first = await seedDemo(deps);
      expect(first.seeded).toBe(true);
      expect(first.members).toBe(DEMO_USERS.length);

      const again = await seedDemo(deps);
      expect(again.members).toBe(DEMO_USERS.length);
      const { rows: categories } = await query(
        c,
        "select 1 from public.user_categories where slug = $1",
        [DEMO_CATEGORY.slug],
      );
      expect(categories).toHaveLength(1);
      const tokenHash = createHash("sha256").update(DEMO_INVITATION.token).digest("hex");
      const { rows: invitations } = await query(
        c,
        "select email, used_at from public.invitations where token_hash = $1",
        [tokenHash],
      );
      expect(invitations).toHaveLength(1);
      expect(invitations[0].email).toBe(DEMO_INVITATION.email);
      expect(invitations[0].used_at).toBeNull();

      const cleared = await clearDemo(deps);
      expect(cleared.seeded).toBe(false);
      expect(cleared.members).toBe(0);
      const { rows: leftovers } = await query(
        c,
        "select (select count(*)::int from auth.users where email like 'demo.%@example.test') as users, (select count(*)::int from public.invitations where token_hash = $1) as invitations",
        [tokenHash],
      );
      expect(leftovers[0]).toMatchObject({ users: 0, invitations: 0 });
    });
  });

  it("refuses to clear while a module still holds demo data", async () => {
    await inRollback(async (c) => {
      await enableDemo(c);
      const admin = await session(c);
      await installModule(modulesDeps(c), admin, manifest());
      await activateModule(modulesDeps(c), admin, "demo-blocker");

      const deps = demoDeps(c);
      await seedDemo(deps);
      await expect(clearDemo(deps)).rejects.toMatchObject({
        code: "conflict",
        details: { code: "demo_linked", module_key: "demo-blocker" },
      });
      // The failed clear rolled back: the marker is still there.
      expect((await demoStatus(deps)).seeded).toBe(true);
    });
  });
});
