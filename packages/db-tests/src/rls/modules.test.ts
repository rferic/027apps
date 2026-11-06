import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from "../pg.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seedUser(c: ClientBase, role: "admin" | "user", name: string) {
  return createTestUser(c, {
    email: `rls-mod-${name}-${uniq()}@test.local`,
    displayName: name,
    role,
  });
}

async function seedModule(
  c: ClientBase,
  key: string,
  state: "installed" | "active" | "disabled",
  isPublic: boolean,
): Promise<void> {
  await query(
    c,
    `insert into public.module_registry
       (key, name, version, state, is_public, mcp_exposed, manifest_digest)
     values ($1, $1, '1.0.0', $2, $3, 'read', $4)`,
    [key, state, isPublic, `sha256:${"0".repeat(64)}`],
  );
}

describe("RLS: modules", () => {
  it("hides private/disabled modules from regular users", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RLS Mod Admin");
      const a = await seedUser(c, "user", "RLS Mod A");
      const installed = `inst-${uniq()}`;
      const pub = `pub-${uniq()}`;
      const priv = `priv-${uniq()}`;
      const disabled = `dis-${uniq()}`;

      await seedModule(c, installed, "installed", false);
      await seedModule(c, pub, "active", true);
      await seedModule(c, priv, "active", false);
      await seedModule(c, disabled, "disabled", true);
      await query(c, "insert into public.user_modules (user_id, module_key, granted_by) values ($1, $2, $3)", [
        a.id,
        priv,
        admin.id,
      ]);

      await impersonate(c, a.id);
      await expect(count(c, "select count(*) from public.module_registry")).resolves.toBe(2);
      await expect(
        count(c, "select count(*) from public.module_registry where key = $1", [installed]),
      ).resolves.toBe(0);
      await expect(
        count(c, "select count(*) from public.module_registry where key = $1", [disabled]),
      ).resolves.toBe(0);

      await c.query("RESET ROLE");
      await impersonate(c, admin.id);
      await expect(count(c, "select count(*) from public.module_registry")).resolves.toBe(4);
      await c.query("ROLLBACK");
    });
  });

  it("anon cannot read the module catalogue", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await impersonateAnon(c);
      await expect(query(c, "select count(*) from public.module_registry")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
  });

  it("module_installer cannot read Core tables or the registry", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE module_installer");
      await expect(query(c, "select count(*) from public.settings")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
    await withClient(async (c) => {
      await c.query("BEGIN");
      await c.query("SET LOCAL ROLE module_installer");
      await expect(query(c, "select count(*) from public.module_registry")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
  });
});
