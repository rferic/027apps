import { describe, it, expect } from "vitest";
import type { ClientBase } from "pg";
import {
  withClient,
  query,
  impersonate,
  impersonateAnon,
  createTestUser,
  createTestModule,
} from "../pg.js";

/**
 * Sprint 18 task 01: the club model (migration 0037).
 *
 * Levels and the invitee tree live on `profiles`; anonymous invitations and
 * their origin live on `invitations`; the four new tables are server-only, like
 * `device_transfers`, so PostgREST never exposes them.
 */

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = (tag: string) => `club-${tag}-${uniq()}@test.local`;

/** 64 lowercase hex chars: the `token_hash`/`code_hash` CHECK shape. */
const hex64 = () =>
  `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`
    .padEnd(64, "0")
    .slice(0, 64);

/** Runs one statement that must be denied and restores the transaction. */
async function assertDenied(
  c: ClientBase,
  sql: string,
  params: unknown[] = [],
): Promise<void> {
  await c.query("savepoint denied");
  await expect(query(c, sql, params)).rejects.toThrowError(/permission denied/i);
  await c.query("rollback to savepoint denied");
}

/** Runs one statement that must violate a constraint and restores the transaction. */
async function assertRejects(
  c: ClientBase,
  sql: string,
  params: unknown[] = [],
  matcher: RegExp = /./,
): Promise<void> {
  await c.query("savepoint rejected");
  await expect(query(c, sql, params)).rejects.toThrowError(matcher);
  await c.query("rollback to savepoint rejected");
}

/**
 * The four server-only tables with one representative statement per operation.
 * The ids are random on purpose: the privilege check runs before any FK.
 */
const SERVER_ONLY_TABLES: Array<{
  table: string;
  insert: string;
  update: string;
}> = [
  {
    table: "invitation_categories",
    insert: `insert into public.invitation_categories (invitation_id, user_category_id)
             values (gen_random_uuid(), gen_random_uuid())`,
    update: "update public.invitation_categories set invitation_id = invitation_id",
  },
  {
    table: "join_codes",
    insert: `insert into public.join_codes (inviter_id, code_hash, expires_at)
             values (gen_random_uuid(), repeat('a', 64), now() + interval '90 seconds')`,
    update: "update public.join_codes set used_at = used_at",
  },
  {
    table: "invitation_requests",
    insert: `insert into public.invitation_requests (requester_id, amount)
             values (gen_random_uuid(), 1)`,
    update: "update public.invitation_requests set reason = reason",
  },
  {
    table: "invitation_quota_grants",
    insert: `insert into public.invitation_quota_grants (user_id, amount)
             values (gen_random_uuid(), 1)`,
    update: "update public.invitation_quota_grants set reason = reason",
  },
];

describe("invitation club schema", () => {
  it("backfills existing users to level 1 and leaves admins without a level", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const plain = await createTestUser(c, { email: email("backfill-user"), role: "user" });
      const leveled = await createTestUser(c, { email: email("backfill-level"), role: "user" });
      const admin = await createTestUser(c, { email: email("backfill-admin"), role: "admin" });
      const root = await createTestUser(c, { email: email("backfill-root"), role: "super_admin" });

      // Rows written before 0037 have no level; one of them already has one.
      await query(
        c,
        "update public.profiles set invite_level = null where id = any($1::uuid[])",
        [[plain.id, admin.id, root.id]],
      );
      await query(c, "update public.profiles set invite_level = 4 where id = $1", [leveled.id]);

      // Exactly the statement 0037 runs: only users without a level are seeded.
      await query(
        c,
        `update public.profiles
            set invite_level = 1
          where role = 'user' and invite_level is null`,
      );

      const { rows } = await query(
        c,
        "select id, role, invite_level from public.profiles where id = any($1::uuid[])",
        [[plain.id, leveled.id, admin.id, root.id]],
      );
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      expect(byId.get(plain.id)).toMatchObject({ role: "user", invite_level: 1 });
      expect(byId.get(leveled.id)).toMatchObject({ role: "user", invite_level: 4 });
      expect(byId.get(admin.id)).toMatchObject({ role: "admin", invite_level: null });
      expect(byId.get(root.id)).toMatchObject({ role: "super_admin", invite_level: null });

      // The level accepts an inherited number above the configured list (D9).
      await query(c, "update public.profiles set invite_level = 100 where id = $1", [plain.id]);
      await assertRejects(
        c,
        "update public.profiles set invite_level = 101 where id = $1",
        [plain.id],
        /check constraint/i,
      );

      await c.query("ROLLBACK");
    });
  });

  it("accepts an anonymous invitation with null email and name", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const admin = await createTestUser(c, { email: email("anon-admin"), role: "admin" });

      const { rows } = await query(
        c,
        `insert into public.invitations (token_hash, expires_at, created_by, depth, source)
         values ($1, now() + interval '15 minutes', $2, 2, 'member')
         returning email, name, source, depth, expires_in_days`,
        [hex64(), admin.id],
      );
      expect(rows[0]).toMatchObject({
        email: null,
        name: null,
        source: "member",
        depth: 2,
        expires_in_days: null,
      });

      // An invitation with no source is an admin invitation, as before.
      const { rows: defaulted } = await query(
        c,
        `insert into public.invitations (email, name, token_hash, expires_at, created_by)
         values ($1, 'Ada', $2, now() + interval '1 day', $3)
         returning source, depth`,
        [email("admin-inv"), hex64(), admin.id],
      );
      expect(defaulted[0]).toMatchObject({ source: "admin" });

      await assertRejects(
        c,
        `insert into public.invitations (token_hash, expires_at, created_by, source)
         values ($1, now() + interval '1 day', $2, 'imported')`,
        [hex64(), admin.id],
        /check constraint/i,
      );

      await c.query("ROLLBACK");
    });
  });

  it("keeps join codes, requests and grants away from anon and authenticated", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const user = await createTestUser(c, { email: email("denied"), role: "user" });

      const checkEveryStatement = async () => {
        for (const entry of SERVER_ONLY_TABLES) {
          await assertDenied(c, `select count(*) from public.${entry.table}`);
          await assertDenied(c, entry.insert);
          await assertDenied(c, entry.update);
          await assertDenied(c, `delete from public.${entry.table}`);
        }
      };

      await impersonateAnon(c);
      await checkEveryStatement();
      await c.query("reset role");

      await impersonate(c, user.id);
      await checkEveryStatement();

      await c.query("ROLLBACK");
    });
  });

  it("grants service_role full DML on the server-only tables", async () => {
    await withClient(async (c) => {
      const { rows } = await query(
        c,
        `select t.table_name,
                has_table_privilege('service_role', format('public.%I', t.table_name), 'select') as can_select,
                has_table_privilege('service_role', format('public.%I', t.table_name), 'insert') as can_insert,
                has_table_privilege('service_role', format('public.%I', t.table_name), 'update') as can_update,
                has_table_privilege('service_role', format('public.%I', t.table_name), 'delete') as can_delete
           from information_schema.tables t
          where t.table_schema = 'public'
            and t.table_name = any($1::text[])
          order by t.table_name`,
        [SERVER_ONLY_TABLES.map((entry) => entry.table)],
      );

      expect(rows).toHaveLength(SERVER_ONLY_TABLES.length);
      expect(
        rows.filter(
          (row) => !row.can_select || !row.can_insert || !row.can_update || !row.can_delete,
        ),
      ).toEqual([]);
    });
  });

  it("allows one pending request per user and a second after it is resolved", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const user = await createTestUser(c, { email: email("requests"), role: "user" });

      const { rows: first } = await query(
        c,
        `insert into public.invitation_requests (requester_id, amount, reason)
         values ($1, 2, 'quiero invitar a mi hermana')
         returning id, state, granted_amount, resolved_at`,
        [user.id],
      );
      expect(first[0]).toMatchObject({ state: "pending", granted_amount: null, resolved_at: null });

      await assertRejects(
        c,
        `insert into public.invitation_requests (requester_id, amount) values ($1, 1)`,
        [user.id],
        /duplicate key|unique/i,
      );

      // A resolved request needs its timestamp: the pair cannot diverge.
      await assertRejects(
        c,
        "update public.invitation_requests set state = 'cancelled' where id = $1",
        [first[0]!.id],
        /check constraint/i,
      );

      await query(
        c,
        "update public.invitation_requests set state = 'cancelled', resolved_at = now() where id = $1",
        [first[0]!.id],
      );

      const { rows: second } = await query(
        c,
        `insert into public.invitation_requests (requester_id, amount)
         values ($1, 3) returning id, state`,
        [user.id],
      );
      expect(second[0]).toMatchObject({ state: "pending" });

      await c.query("ROLLBACK");
    });
  });

  it("defaults module_registry.delegable to false", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const key = `club-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await createTestModule(c, key);

      const { rows } = await query(
        c,
        "select delegable from public.module_registry where key = $1",
        [key],
      );
      expect(rows[0]).toMatchObject({ delegable: false });

      await query(c, "update public.module_registry set delegable = true where key = $1", [key]);
      const { rows: updated } = await query(
        c,
        "select delegable from public.module_registry where key = $1",
        [key],
      );
      expect(updated[0]).toMatchObject({ delegable: true });

      await c.query("ROLLBACK");
    });
  });

  it("keeps invited_by and invite_level out of the owner's editable columns", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      const user = await createTestUser(c, { email: email("owner"), role: "user" });
      const inviter = await createTestUser(c, { email: email("owner-inviter"), role: "admin" });

      await impersonate(c, user.id);
      // The preferences the owner may edit still work.
      await expect(
        query(c, "update public.profiles set display_name = 'Nombre propio' where id = $1", [
          user.id,
        ]),
      ).resolves.toMatchObject({ rows: [] });

      await assertDenied(
        c,
        "update public.profiles set invite_level = 5 where id = $1",
        [user.id],
      );
      await assertDenied(
        c,
        "update public.profiles set invited_by = $2 where id = $1",
        [user.id, inviter.id],
      );

      await c.query("ROLLBACK");
    });
  });
});
