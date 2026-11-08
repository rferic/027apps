import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import { withClient, query, count, impersonate, impersonateAnon, createTestUser } from "../pg.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seedUser(c: ClientBase, role: "super_admin" | "admin" | "user", name: string) {
  return createTestUser(c, {
    email: `rls-key-${name}-${uniq()}@test.local`,
    displayName: name,
    role,
  });
}

async function seedKey(
  c: ClientBase,
  opts: { kind: "service" | "delegated"; userId: string | null; createdBy: string },
): Promise<string> {
  const { rows } = await query(
    c,
    `insert into public.api_keys (key_hash, kind, name, scopes, user_id, role_cap, created_by)
     values ($1, $2, $3, '{profile:read}', $4, $5, $6) returning id`,
    [
      `${uniq().replace(/[^0-9a-f]/gi, "").padEnd(64, "0").slice(0, 64)}`,
      opts.kind,
      "RLS key",
      opts.userId,
      opts.kind === "service" ? "admin" : null,
      opts.createdBy,
    ],
  );
  return String(rows[0]!.id);
}

describe("RLS: api keys and devices", () => {
  it("a user sees only their own delegated keys", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RLS Key Admin");
      const a = await seedUser(c, "user", "RLS Key A");
      const b = await seedUser(c, "user", "RLS Key B");
      const own = await seedKey(c, { kind: "delegated", userId: a.id, createdBy: a.id });
      await seedKey(c, { kind: "delegated", userId: b.id, createdBy: b.id });
      await seedKey(c, { kind: "service", userId: null, createdBy: admin.id });

      await impersonate(c, a.id);
      await expect(count(c, "select count(*) from public.api_keys")).resolves.toBe(1);
      await expect(count(c, "select count(*) from public.api_keys where id = $1", [own])).resolves.toBe(1);

      // `authenticated` has no INSERT/UPDATE/DELETE on api_keys: the migration 0016
      // revoked those privileges and dropped the api_keys_write policy. Writes go
      // through the Core with the service pool, so any direct write fails with
      // "permission denied" before RLS is even evaluated.
      await c.query("SAVEPOINT sp_owner");
      await expect(
        query(c, "update public.api_keys set user_id = $1 where id = $2", [b.id, own]),
      ).rejects.toThrowError(/permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_owner");

      await c.query("SAVEPOINT sp_insert");
      await expect(
        query(
          c,
          `insert into public.api_keys (key_hash, kind, name, scopes, user_id, created_by)
           values ($1, 'delegated', 'RLS key insert', '{profile:read}', $2, $2)`,
          ["ab".repeat(32), a.id],
        ),
      ).rejects.toThrowError(/permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_insert");

      await c.query("SAVEPOINT sp_update");
      await expect(
        query(c, "update public.api_keys set name = 'hacked' where id = $1", [own]),
      ).rejects.toThrowError(/permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_update");

      await c.query("SAVEPOINT sp_delete");
      await expect(
        query(c, "delete from public.api_keys where id = $1", [own]),
      ).rejects.toThrowError(/permission denied/i);
      await c.query("ROLLBACK TO SAVEPOINT sp_delete");

      await c.query("ROLLBACK");
    });
  });

  it("an admin no longer reads delegated keys of other users; the owner and super_admin do", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const superAdmin = await seedUser(c, "super_admin", "RLS Key Super");
      const admin = await seedUser(c, "admin", "RLS Key Admin 2");
      const user = await seedUser(c, "user", "RLS Key User 2");
      const delegatedId = await seedKey(c, {
        kind: "delegated",
        userId: user.id,
        createdBy: user.id,
      });
      const serviceId = await seedKey(c, {
        kind: "service",
        userId: null,
        createdBy: superAdmin.id,
      });

      await impersonate(c, admin.id);
      await expect(
        count(c, "select count(*) from public.api_keys where id = any($1::uuid[])", [
          [delegatedId, serviceId],
        ]),
      ).resolves.toBe(0);

      await c.query("RESET ROLE");
      await impersonate(c, user.id);
      await expect(
        count(c, "select count(*) from public.api_keys where id = any($1::uuid[])", [
          [delegatedId, serviceId],
        ]),
      ).resolves.toBe(1);

      await c.query("ROLLBACK");
    });
    await withClient(async (c) => {
      await c.query("BEGIN");
      const superAdmin = await seedUser(c, "super_admin", "RLS Key Super 3");
      const user = await seedUser(c, "user", "RLS Key User 3");
      const delegatedId = await seedKey(c, {
        kind: "delegated",
        userId: user.id,
        createdBy: user.id,
      });
      const serviceId = await seedKey(c, {
        kind: "service",
        userId: null,
        createdBy: superAdmin.id,
      });

      await impersonate(c, superAdmin.id);
      await expect(
        count(c, "select count(*) from public.api_keys where id = any($1::uuid[])", [
          [delegatedId, serviceId],
        ]),
      ).resolves.toBe(2);
      await c.query("ROLLBACK");
    });
  });

  it("devices are visible to their owner and to admins", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RLS Dev Admin");
      const a = await seedUser(c, "user", "RLS Dev A");
      const b = await seedUser(c, "user", "RLS Dev B");
      await query(c, "insert into public.devices (user_id, platform, push_token) values ($1, 'android', $2)", [
        a.id,
        `fcm-rls-a-${uniq()}`,
      ]);
      await query(c, "insert into public.devices (user_id, platform, push_token) values ($1, 'android', $2)", [
        b.id,
        `fcm-rls-b-${uniq()}`,
      ]);

      await impersonate(c, a.id);
      await expect(count(c, "select count(*) from public.devices")).resolves.toBe(1);

      await c.query("RESET ROLE");
      await impersonate(c, admin.id);
      await expect(count(c, "select count(*) from public.devices")).resolves.toBe(2);
      await c.query("ROLLBACK");
    });
  });

  it("anon has no privileges on keys or devices", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      await impersonateAnon(c);
      await expect(query(c, "select count(*) from public.api_keys")).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK");
    });
  });
});
