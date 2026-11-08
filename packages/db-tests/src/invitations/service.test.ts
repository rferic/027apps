import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestModule, createTestUser, query, withClient } from "../pg.js";
import {
  createInvitation,
  hashInvitationToken,
  listInvitations,
  redeemInvitation,
  revokeInvitation,
  type InvitationStatusFilter,
  type InvitationsAuth,
  type InvitationsDeps,
} from "@027apps/core/invitations/service.js";
import type { Caller } from "@027apps/core/api/types.js";

const PAGE = { limit: 100, offset: 0 };

const email = (name: string) => `inv-${name}-${Date.now()}-${Math.random()}@test.local`;

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    await createTestModule(c, "expenses");
    await createTestModule(c, "balances");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

/** Auth user without a profile: redemption must create the profile itself. */
const AUTH_USER_INSERT = `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
     values ($1, '00000000-0000-0000-0000-000000000000', $2, crypt('test-password', gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')`;

async function createAuthUserOnly(c: ClientBase, email: string): Promise<string> {
  const id = crypto.randomUUID();
  await c.query(AUTH_USER_INSERT, [id, email]);
  return id;
}

/**
 * Deps backed by real connections (each call gets its own client), so a
 * concurrent redemption can be exercised against the row lock.
 */
function liveDeps(): { deps: InvitationsDeps; created: string[] } {
  const created: string[] = [];
  const port: InvitationsAuth = {
    async findUserByEmail(value) {
      const { rows } = await withClient((c) =>
        query(c, "select id from auth.users where email = $1 limit 1", [value]),
      );
      return rows[0] ? { id: String(rows[0].id) } : null;
    },
    async createUser({ email: value }) {
      const id = crypto.randomUUID();
      try {
        await withClient((c) => c.query(AUTH_USER_INSERT, [id, value]));
        created.push(id);
        return { id, created: true };
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
        const { rows } = await withClient((c) =>
          query(c, "select id from auth.users where email = $1 limit 1", [value]),
        );
        if (!rows[0]) throw err;
        return { id: String(rows[0].id), created: false };
      }
    },
    async deleteUser(userId) {
      await withClient(async (c) => {
        await c.query("delete from public.profiles where id = $1", [userId]);
        await c.query("delete from auth.users where id = $1", [userId]);
      });
    },
  };

  return {
    created,
    deps: {
      auth: port,
      db: { query: (sql: string, params: unknown[] = []) => withClient((c) => query(c, sql, params)) },
      withTransaction: (fn) =>
        withClient((c) => fn({ query: (sql: string, params: unknown[] = []) => query(c, sql, params) })),
    },
  };
}

async function admin(c: ClientBase): Promise<Caller> {
  const { id } = await createTestUser(c, { email: email("admin"), role: "super_admin" });
  return { kind: "session", userId: id, role: "super_admin" };
}

function authPort(c: ClientBase, seed: { id: string; email: string }[] = []): {
  port: InvitationsAuth;
  created: string[];
  deleted: string[];
} {
  const users = new Map(seed.map((user) => [user.email, user.id]));
  const created: string[] = [];
  const deleted: string[] = [];

  return {
    created,
    deleted,
    port: {
      async findUserByEmail(value) {
        return users.has(value) ? { id: users.get(value)! } : null;
      },
      async createUser({ email: value }) {
        const id = await createAuthUserOnly(c, value);
        users.set(value, id);
        created.push(id);
        return { id, created: true };
      },
      async deleteUser(userId) {
        deleted.push(userId);
        await query(c, "delete from public.profiles where id = $1", [userId]);
        await query(c, "delete from auth.users where id = $1", [userId]);
      },
    },
  };
}

function deps(c: ClientBase, auth: InvitationsAuth): InvitationsDeps {
  return { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) }, auth };
}

async function category(c: ClientBase, adminId: string, name = "Familia"): Promise<string> {
  const { rows } = await query(
    c,
    "insert into public.user_categories (name, slug, created_by) values ($1, $2, $3) returning id",
    [name, `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`, adminId],
  );
  return String(rows[0]!.id);
}

describe("invitations service", () => {
  it("stores only the token hash and lists a pending invitation with its modules", async () => {
    await inRollback(async (c) => {
      await query(c, "delete from public.event_outbox");
      const who = await admin(c);
      const auth = authPort(c);
      const inv = await createInvitation(deps(c, auth.port), who, {
        email: email("pending"),
        name: "Ana",
        modules: ["expenses", "balances"],
      });

      expect(inv.token.startsWith("027_inv_")).toBe(true);
      expect(inv.invitation.status).toBe("pending");
      expect(inv.invitation.modules).toEqual(["balances", "expenses"]);

      const { rows } = await query(c, "select token_hash from public.invitations where id = $1", [
        inv.invitation.id,
      ]);
      expect(rows[0]!.token_hash).toBe(hashInvitationToken(inv.token));
      expect(rows[0]!.token_hash).not.toContain("027_inv_");

      const listed = (await listInvitations(deps(c, auth.port), PAGE)).invitations;
      const created = listed.find((item) => item.id === inv.invitation.id);
      expect(created).toBeDefined();
      expect(created).not.toHaveProperty("token");
      expect(created!.modules).toEqual(["balances", "expenses"]);

      const { rows: event } = await query(c, "select type, target from public.event_outbox where type = 'invitation.created'");
      expect(event).toEqual([{ type: "invitation.created", target: "admins" }]);
    });
  });

  it("computes pending, used, expired and revoked states", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const auth = authPort(c);
      const d = deps(c, auth.port);

      const pending = await createInvitation(d, who, { email: email("a"), name: "A" });
      const used = await createInvitation(d, who, { email: email("b"), name: "B" });
      const expired = await createInvitation(d, who, { email: email("c"), name: "C" });
      const revoked = await createInvitation(d, who, { email: email("d"), name: "D" });

      await query(c, "update public.invitations set used_at = now() where id = $1", [used.invitation.id]);
      await query(
        c,
        "update public.invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [expired.invitation.id],
      );
      await revokeInvitation(d, revoked.invitation.id);

      const states = Object.fromEntries(
        (await listInvitations(d, PAGE)).invitations.map((item) => [item.id, item.status]),
      );
      expect(states[pending.invitation.id]).toBe("pending");
      expect(states[used.invitation.id]).toBe("used");
      expect(states[expired.invitation.id]).toBe("expired");
      expect(states[revoked.invitation.id]).toBe("revoked");
    });
  });

  it("revokes idempotently and refuses to revoke a used invitation", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const d = deps(c, authPort(c).port);
      const inv = await createInvitation(d, who, { email: email("revoke"), name: "Revoke" });

      await revokeInvitation(d, inv.invitation.id);
      await expect(revokeInvitation(d, inv.invitation.id)).resolves.toBeUndefined();

      await query(c, "update public.invitations set used_at = now() where id = $1", [inv.invitation.id]);
      await expect(revokeInvitation(d, inv.invitation.id)).rejects.toMatchObject({
        code: "invitation_used",
      });
      await expect(revokeInvitation(d, crypto.randomUUID())).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  it("redeems once: profile, category membership and materialised modules", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const auth = authPort(c);
      const d = deps(c, auth.port);
      if (who.kind !== "session") throw new Error("expected a session caller");
      const cat = await category(c, who.userId, "Familia");
      const inv = await createInvitation(d, who, {
        email: email("redeem"),
        name: "Redeem",
        user_category_id: cat,
        modules: ["expenses"],
      });

      const result = await redeemInvitation(d, inv.token, {
        email: inv.invitation.email,
        password: "correct-horse-battery",
        display_name: "Redeem Real",
      });
      expect(result.invitation_id).toBe(inv.invitation.id);
      expect(result.user.display_name).toBe("Redeem Real");

      const { rows: profile } = await query(c, "select role from public.profiles where id = $1", [
        result.user.id,
      ]);
      expect(profile[0]!.role).toBe("user");

      const { rows: member } = await query(
        c,
        "select 1 from public.user_category_members where user_id = $1 and user_category_id = $2",
        [result.user.id, cat],
      );
      expect(member).toHaveLength(1);

      const { rows: grant } = await query(
        c,
        "select module_key, revoked_at from public.user_modules where user_id = $1",
        [result.user.id],
      );
      expect(grant).toEqual([{ module_key: "expenses", revoked_at: null }]);

      const { rows: used } = await query(c, "select used_at from public.invitations where id = $1", [
        inv.invitation.id,
      ]);
      expect(used[0]!.used_at).not.toBeNull();

      await expect(
        redeemInvitation(d, inv.token, {
          email: inv.invitation.email,
          password: "correct-horse-battery",
        }),
      ).rejects.toMatchObject({ code: "invitation_used" });
    });
  });

  it("seeds the new profile with the instance localization settings", async () => {
    await inRollback(async (c) => {
      await query(
        c,
        "update public.settings set value = '\"es\"'::jsonb where key = 'localization.default_locale'",
      );
      await query(
        c,
        "update public.settings set value = '\"Europe/Madrid\"'::jsonb where key = 'localization.timezone'",
      );

      const who = await admin(c);
      const auth = authPort(c);
      const d = deps(c, auth.port);
      const inv = await createInvitation(d, who, { email: email("locale"), name: "Locale" });

      const result = await redeemInvitation(d, inv.token, {
        email: inv.invitation.email,
        password: "correct-horse-battery",
      });

      const { rows } = await query(
        c,
        "select locale, timezone from public.profiles where id = $1",
        [result.user.id],
      );
      expect(rows).toEqual([{ locale: "es", timezone: "Europe/Madrid" }]);
    });
  });

  it("rejects expired, revoked and mismatched-email redemptions without creating users", async () => {    await inRollback(async (c) => {
      const who = await admin(c);
      const auth = authPort(c);
      const d = deps(c, auth.port);

      const expired = await createInvitation(d, who, { email: email("exp"), name: "Exp" });
      await query(
        c,
        "update public.invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [expired.invitation.id],
      );
      await expect(
        redeemInvitation(d, expired.token, {
          email: expired.invitation.email,
          password: "correct-horse-battery",
        }),
      ).rejects.toMatchObject({ code: "invitation_expired" });

      const revoked = await createInvitation(d, who, { email: email("rev"), name: "Rev" });
      await revokeInvitation(d, revoked.invitation.id);
      await expect(
        redeemInvitation(d, revoked.token, {
          email: revoked.invitation.email,
          password: "correct-horse-battery",
        }),
      ).rejects.toMatchObject({ code: "not_found" });

      const mismatch = await createInvitation(d, who, { email: email("one"), name: "One" });
      await expect(
        redeemInvitation(d, mismatch.token, {
          email: email("two"),
          password: "correct-horse-battery",
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });

      expect(auth.created).toHaveLength(0);
    });
  });

  it("reuses an existing account instead of creating a new Auth user", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const existingEmail = email("existing");
      const existing = await createTestUser(c, { email: existingEmail });
      // Creation refuses an email that already belongs to a member, so the
      // invitation has to predate the account (the race redemption guards).
      const inv = await createInvitation(deps(c, authPort(c).port), who, {
        email: existingEmail,
        name: "Existing",
      });
      const auth = authPort(c, [{ id: existing.id, email: existingEmail }]);
      const d = deps(c, auth.port);

      const result = await redeemInvitation(d, inv.token, {
        email: inv.invitation.email,
        password: "correct-horse-battery",
      });
      expect(result.user.id).toBe(existing.id);
      expect(auth.created).toHaveLength(0);
    });
  });

  it("refuses to redeem for a deactivated account", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const existingEmail = email("deactivated");
      const existing = await createTestUser(c, { email: existingEmail });
      await query(c, "update public.profiles set deactivated_at = now() where id = $1", [existing.id]);
      const inv = await createInvitation(deps(c, authPort(c).port), who, {
        email: existingEmail,
        name: "Gone",
      });
      const auth = authPort(c, [{ id: existing.id, email: existingEmail }]);
      const d = deps(c, auth.port);

      await expect(
        redeemInvitation(d, inv.token, {
          email: inv.invitation.email,
          password: "correct-horse-battery",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(auth.created).toHaveLength(0);
    });
  });

  it("deletes the Auth user when the database step fails", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const auth = authPort(c);
      const d = deps(c, auth.port);
      const inv = await createInvitation(d, who, { email: email("orphan"), name: "Orphan" });

      // Simulate a database failure after the Auth user was created.
      const broken: InvitationsDeps = {
        ...d,
        db: {
          query: async (sql: string, params: unknown[] = []) => {
            if (sql.includes("insert into public.user_modules")) throw new Error("db down");
            return query(c, sql, params);
          },
        },
      };

      await expect(
        redeemInvitation(broken, inv.token, {
          email: inv.invitation.email,
          password: "correct-horse-battery",
        }),
      ).rejects.toThrow("db down");
      expect(auth.deleted).toEqual(auth.created);
      expect(auth.created).toHaveLength(1);
    });
  });

  it("redeems exactly once under two concurrent requests", async () => {
    const live = liveDeps();
    const inviteEmail = email("concurrent");
    let adminId = "";

    try {
      await withClient(async (c) => {
        const created = await createTestUser(c, { email: email("conc-admin"), role: "super_admin" });
        adminId = created.id;
      });
      const who: Caller = { kind: "session", userId: adminId, role: "super_admin" };
      const inv = await createInvitation(live.deps, who, { email: inviteEmail, name: "Concurrent" });

      const attempts = await Promise.allSettled([
        redeemInvitation(live.deps, inv.token, {
          email: inviteEmail,
          password: "correct-horse-battery",
        }),
        redeemInvitation(live.deps, inv.token, {
          email: inviteEmail,
          password: "correct-horse-battery",
        }),
      ]);

      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = attempts.find((result) => result.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      expect(rejected?.reason).toMatchObject({ code: "invitation_used" });
    } finally {
      await withClient(async (c) => {
        await c.query("delete from public.invitations where email = $1", [inviteEmail]);
        const ids = [adminId, ...live.created].filter(Boolean);
        await c.query(
          "delete from public.event_outbox where resource->>'email' = $1 or payload->>'user_id' = any($2::text[])",
          [inviteEmail, ids],
        );
        await c.query("delete from public.profiles where id = any($1::uuid[])", [ids]);
        await c.query("delete from auth.users where id = any($1::uuid[])", [ids]);
      });
    }
  });
});

describe("createInvitation rules", () => {
  it("rejects a second pending invitation for the same email", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const d = deps(c, authPort(c).port);
      const inviteEmail = email("duplicate");

      await createInvitation(d, who, { email: inviteEmail, name: "One" });

      await expect(
        createInvitation(d, who, { email: inviteEmail, name: "Two" }),
      ).rejects.toMatchObject({
        code: "conflict",
        message: "That email already has a pending invitation",
        details: { code: "pending_invitation" },
      });

      const { rows } = await query(
        c,
        "select count(*)::int as n from public.invitations where email = $1",
        [inviteEmail],
      );
      expect(rows[0]!.n).toBe(1);
    });
  });

  it("rejects an email that already belongs to a member", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const memberEmail = email("member");
      const member = await createTestUser(c, { email: memberEmail });
      const auth = authPort(c, [{ id: member.id, email: memberEmail }]);

      await expect(
        createInvitation(deps(c, auth.port), who, { email: memberEmail, name: "Member" }),
      ).rejects.toMatchObject({
        code: "conflict",
        message: "That email already belongs to a member",
        details: { code: "email_registered" },
      });

      const { rows } = await query(
        c,
        "select count(*)::int as n from public.invitations where email = $1",
        [memberEmail],
      );
      expect(rows[0]!.n).toBe(0);
    });
  });

  it("allows the email of a used or an expired invitation", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const d = deps(c, authPort(c).port);
      const usedEmail = email("used-again");
      const expiredEmail = email("expired-again");

      const used = await createInvitation(d, who, { email: usedEmail, name: "Used" });
      await query(c, "update public.invitations set used_at = now() where id = $1", [
        used.invitation.id,
      ]);

      const expired = await createInvitation(d, who, { email: expiredEmail, name: "Expired" });
      await query(
        c,
        "update public.invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [expired.invitation.id],
      );

      await expect(
        createInvitation(d, who, { email: usedEmail, name: "Used again" }),
      ).resolves.toMatchObject({ invitation: { status: "pending" } });
      await expect(
        createInvitation(d, who, { email: expiredEmail, name: "Expired again" }),
      ).resolves.toMatchObject({ invitation: { status: "pending" } });
    });
  });

  it("normalises the email before storing and comparing it", async () => {
    await inRollback(async (c) => {
      const who = await admin(c);
      const d = deps(c, authPort(c).port);
      const raw = email("normalise");
      const mixed = `  ${raw.toUpperCase()} `;

      const created = await createInvitation(d, who, { email: mixed, name: "Normalised" });

      expect(created.invitation.email).toBe(raw);
      await expect(
        createInvitation(d, who, { email: `${raw.toUpperCase()}`, name: "Again" }),
      ).rejects.toMatchObject({ code: "conflict", details: { code: "pending_invitation" } });
    });
  });

  it("filters the list by derived status and keeps the total in sync", async () => {
    await inRollback(async (c) => {
      // The local stack may hold invitations from other runs; the filter and its
      // total are only deterministic with a clean table.
      await query(c, "delete from public.invitations");

      const who = await admin(c);
      const d = deps(c, authPort(c).port);

      const pending = await createInvitation(d, who, { email: email("f-pending"), name: "P" });
      const used = await createInvitation(d, who, { email: email("f-used"), name: "U" });
      const expired = await createInvitation(d, who, { email: email("f-expired"), name: "E" });
      const revoked = await createInvitation(d, who, { email: email("f-revoked"), name: "R" });

      await query(c, "update public.invitations set used_at = now() where id = $1", [
        used.invitation.id,
      ]);
      await query(
        c,
        "update public.invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [expired.invitation.id],
      );
      await revokeInvitation(d, revoked.invitation.id);

      const ids = async (status: InvitationStatusFilter) => {
        const result = await listInvitations(d, { ...PAGE, status });
        expect(result.total).toBe(result.invitations.length);
        expect(result.invitations.every((row) => row.status === status)).toBe(true);
        return result.invitations.map((row) => row.id);
      };

      expect(await ids("pending")).toEqual([pending.invitation.id]);
      expect(await ids("used")).toEqual([used.invitation.id]);
      expect(await ids("expired")).toEqual([expired.invitation.id]);
      expect(await ids("revoked")).toEqual([revoked.invitation.id]);
      expect(await listInvitations(d, { ...PAGE, status: "all" })).toMatchObject({ total: 4 });
    });
  });

  it("leaves a single invitation when two creates race for the same email", async () => {
    const live = liveDeps();
    const inviteEmail = email("create-race");
    let adminId = "";

    try {
      await withClient(async (c) => {
        const created = await createTestUser(c, { email: email("race-admin"), role: "super_admin" });
        adminId = created.id;
      });
      const who: Caller = { kind: "session", userId: adminId, role: "super_admin" };

      const attempts = await Promise.allSettled([
        createInvitation(live.deps, who, { email: inviteEmail, name: "One" }),
        createInvitation(live.deps, who, { email: inviteEmail, name: "Two" }),
      ]);

      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      const rejected = attempts.find((attempt) => attempt.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      expect(rejected?.reason).toMatchObject({
        code: "conflict",
        details: { code: "pending_invitation" },
      });

      await withClient(async (c) => {
        const { rows } = await query(
          c,
          "select count(*)::int as n from public.invitations where email = $1",
          [inviteEmail],
        );
        expect(rows[0]!.n).toBe(1);
      });
    } finally {
      await withClient(async (c) => {
        await c.query("delete from public.invitations where email = $1", [inviteEmail]);
        if (adminId) {
          await c.query("delete from public.event_outbox where resource->>'email' = $1", [
            inviteEmail,
          ]);
          await c.query("delete from public.profiles where id = $1", [adminId]);
          await c.query("delete from auth.users where id = $1", [adminId]);
        }
      });
    }
  });
});
