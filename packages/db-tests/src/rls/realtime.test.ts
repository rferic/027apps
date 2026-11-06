import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import { withClient, query, impersonate, createTestUser, count } from "../pg.js";

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function seedUser(c: ClientBase, role: "admin" | "user", name: string) {
  return createTestUser(c, {
    email: `rls-rt-${name}-${uniq()}@test.local`,
    displayName: name,
    role,
  });
}

describe("core_can_subscribe", () => {
  it("allows admins, all and the user channel, denies other users and unknown topics", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RT Admin");
      const user = await seedUser(c, "user", "RT User");
      const other = await seedUser(c, "user", "RT Other");

      await impersonate(c, admin.id);
      await expect(query(c, "select public.core_can_subscribe('admins') as ok")).resolves.toMatchObject({
        rows: [{ ok: true }],
      });
      await c.query("RESET ROLE");

      await impersonate(c, user.id);
      await expect(query(c, "select public.core_can_subscribe('all') as ok")).resolves.toMatchObject({
        rows: [{ ok: true }],
      });
      await expect(query(c, "select public.core_can_subscribe('admins') as ok")).resolves.toMatchObject({
        rows: [{ ok: false }],
      });
      await expect(
        query(c, `select public.core_can_subscribe('user-${user.id}') as ok`),
      ).resolves.toMatchObject({ rows: [{ ok: true }] });
      await expect(
        query(c, `select public.core_can_subscribe('user-${other.id}') as ok`),
      ).resolves.toMatchObject({ rows: [{ ok: false }] });
      await expect(
        query(c, "select public.core_can_subscribe('expense-group-not-a-uuid') as ok"),
      ).resolves.toMatchObject({ rows: [{ ok: false }] });
      await c.query("ROLLBACK");
    });
  });

  it("lets only channel members subscribe, and fails closed when the module is disabled", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RT Chan Admin");
      const member = await seedUser(c, "user", "RT Chan Member");
      const outsider = await seedUser(c, "user", "RT Chan Outsider");
      const moduleKey = `rt-${uniq()}`;
      const topic = `expense-group-${crypto.randomUUID()}`;

      await query(
        c,
        `insert into public.module_registry (key, name, version, state, manifest_digest)
         values ($1, $1, '1.0.0', 'active', 'sha256:0000000000000000000000000000000000000000000000000000000000000000')`,
        [moduleKey],
      );
      await query(
        c,
        "insert into public.module_channels (module_key, pattern, members_fn) values ($1, 'expense-group-{id}', 'test_rt_members')",
        [moduleKey],
      );
      await c.query(
        `create or replace function public.test_rt_members(topic text)
         returns setof uuid
         language sql security definer stable set search_path = ''
         as $$ select '${member.id}'::uuid $$`,
      );
      await c.query("revoke execute on function public.test_rt_members(text) from public, anon");

      await impersonate(c, member.id);
      await expect(
        query(c, `select public.core_can_subscribe('${topic}') as ok`),
      ).resolves.toMatchObject({ rows: [{ ok: true }] });
      await c.query("RESET ROLE");

      await impersonate(c, outsider.id);
      await expect(
        query(c, `select public.core_can_subscribe('${topic}') as ok`),
      ).resolves.toMatchObject({ rows: [{ ok: false }] });
      await c.query("SAVEPOINT sp_direct");
      await expect(query(c, "select public.test_rt_members($1)", [topic])).rejects.toThrowError(
        /permission denied/i,
      );
      await c.query("ROLLBACK TO SAVEPOINT sp_direct");

      await c.query("RESET ROLE");
      await query(c, "update public.module_registry set state = 'disabled' where key = $1", [moduleKey]);
      await impersonate(c, member.id);
      await expect(
        query(c, `select public.core_can_subscribe('${topic}') as ok`),
      ).resolves.toMatchObject({ rows: [{ ok: false }] });
      await c.query("ROLLBACK");
    });
  });

  it("applies the single realtime.messages policy without permissive OR", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await seedUser(c, "admin", "RT Msg Admin");
      const user = await seedUser(c, "user", "RT Msg User");

      for (const topic of ["admins", "all", `user-${admin.id}`]) {
        await c.query(
          "insert into realtime.messages (topic, extension, payload) values ($1, 'broadcast', '{}'::jsonb)",
          [topic],
        );
      }

      await impersonate(c, user.id);
      await c.query("select set_config('realtime.topic', 'all', true)");
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(3);
      await c.query("select set_config('realtime.topic', 'admins', true)");
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(0);
      await c.query(`select set_config('realtime.topic', 'user-${admin.id}', true)`);
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(0);

      await c.query("RESET ROLE");
      await impersonate(c, admin.id);
      await c.query("select set_config('realtime.topic', 'admins', true)");
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(3);
      await c.query("select set_config('realtime.topic', 'all', true)");
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(3);
      await c.query(`select set_config('realtime.topic', 'user-${admin.id}', true)`);
      await expect(count(c, "select count(*) from realtime.messages")).resolves.toBe(3);
      await c.query("ROLLBACK");
    });
  });
});
