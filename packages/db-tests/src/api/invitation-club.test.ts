import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestModule, createTestUser, query, withClient } from "../pg.js";
import {
  createMemberInvitation,
  listOwnInvitations,
  revokeOwnInvitation,
} from "@027apps/core/invitations/member.js";
import {
  approveInvitationRequest,
  cancelInvitationRequest,
  grantInvitationQuota,
  listInvitationGrants,
  rejectInvitationRequest,
  requestInvitationQuota,
  revokeInvitationGrant,
} from "@027apps/core/invitations/requests.js";
import {
  createJoinCode,
  exchangeJoinCode,
  previewJoinCode,
} from "@027apps/core/invitations/join-codes.js";
import {
  previewInvitation,
  redeemInvitation,
} from "@027apps/core/invitations/service.js";
import type { InvitationsDeps } from "@027apps/core/invitations/service.js";
import type { Caller } from "@027apps/core/api/types.js";

/**
 * Sprint 18 task 03: member invitations and rotating QR codes against the real
 * schema. The unit fakes cover the shapes; this file covers the SQL that a fake
 * cannot — the inherited package, the quota race and the single-use exchange.
 */
const email = (name: string) => `club-${name}-${Date.now()}-${Math.random()}@test.local`;

const DEFAULT_LEVELS = '[{"level":1,"quota":5},{"level":2,"quota":2},{"level":3,"quota":1}]';

async function setLevels(c: ClientBase, json: string): Promise<void> {
  await query(c, "update public.settings set value = $1::jsonb where key = 'invitations.levels'", [
    json,
  ]);
}

async function getLevels(c: ClientBase): Promise<string> {
  const { rows } = await query(
    c,
    "select value::text as value from public.settings where key = 'invitations.levels'",
  );
  return String(rows[0]?.value ?? "[]");
}

/** Deps on one shared client (the caller already holds the transaction). */
function deps(c: ClientBase): InvitationsDeps {
  return {
    db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
    auth: {
      async findUserByEmail() {
        return null;
      },
      async createUser() {
        throw new Error("createUser must not run in this test");
      },
      async deleteUser() {},
    },
  };
}

/** Deps on fresh connections: each transaction gets its own client (for races). */
function liveDeps(): InvitationsDeps {
  return {
    db: { query: (sql: string, params: unknown[] = []) => withClient((c) => query(c, sql, params)) },
    withTransaction: (fn) =>
      withClient((c) => fn({ query: (sql: string, params: unknown[] = []) => query(c, sql, params) })),
    auth: {
      async findUserByEmail() {
        return null;
      },
      async createUser() {
        throw new Error("createUser must not run in this test");
      },
      async deleteUser() {},
    },
  };
}

/** Auth port that really creates/reads `auth.users` for redemption tests. */
function redeemDeps(c: ClientBase): InvitationsDeps {
  return {
    db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
    auth: {
      async findUserByEmail(address: string) {
        const { rows } = await query(c, "select id from auth.users where email = $1", [address]);
        return rows[0] ? { id: String(rows[0].id) } : null;
      },
      async createUser(input: { email: string; password: string; displayName: string }) {
        const id = crypto.randomUUID();
        await query(
          c,
          `insert into auth.users
             (id, instance_id, email, encrypted_password, email_confirmed_at,
              raw_app_meta_data, raw_user_meta_data, aud, role)
           values ($1, '00000000-0000-0000-0000-000000000000', $2,
                   crypt('test-password', gen_salt('bf')), now(),
                   '{"provider":"email","providers":["email"]}', '{}',
                   'authenticated', 'authenticated')`,
          [id, input.email],
        );
        return { id, created: true };
      },
      async deleteUser() {},
    },
  };
}

async function member(
  c: ClientBase,
  opts: { name: string; level?: number | null },
): Promise<string> {
  const { id } = await createTestUser(c, { email: email(opts.name) });
  await query(c, "update public.profiles set invite_level = $2 where id = $1", [
    id,
    opts.level ?? 1,
  ]);
  return id;
}

async function moduleWith(
  c: ClientBase,
  key: string,
  opts: { isPublic: boolean; delegable: boolean },
): Promise<void> {
  await createTestModule(c, key);
  await query(
    c,
    "update public.module_registry set is_public = $2, delegable = $3 where key = $1",
    [key, opts.isPublic, opts.delegable],
  );
}

async function grantModule(c: ClientBase, userId: string, key: string): Promise<void> {
  await query(c, "insert into public.user_modules (user_id, module_key) values ($1, $2)", [
    userId,
    key,
  ]);
}

async function category(c: ClientBase, createdBy: string, name = "Familia"): Promise<string> {
  const { rows } = await query(
    c,
    "insert into public.user_categories (name, slug, created_by) values ($1, $2, $3) returning id",
    [name, `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdBy],
  );
  return String(rows[0]!.id);
}

describe("member invitations", () => {
  it("mints an anonymous 48h invitation that inherits the right package", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, DEFAULT_LEVELS);
        const inviter = await member(c, { name: "inviter", level: 2 });
        await query(c, "update public.profiles set locale = 'es' where id = $1", [inviter]);
        await moduleWith(c, "expenses", { isPublic: true, delegable: false });
        await moduleWith(c, "balances", { isPublic: false, delegable: true });
        await moduleWith(c, "secrets", { isPublic: false, delegable: false });
        await grantModule(c, inviter, "expenses");
        await grantModule(c, inviter, "balances");
        await grantModule(c, inviter, "secrets");
        const cat = await category(c, inviter);
        await query(
          c,
          "insert into public.user_category_members (user_category_id, user_id) values ($1, $2)",
          [cat, inviter],
        );

        const caller: Caller = { kind: "session", userId: inviter, role: "user" };
        const result = await createMemberInvitation(deps(c), caller);

        expect(result.token).toMatch(/^027_inv_/);
        expect(result.path).toBe(`/invite/${result.token}`);
        expect(result.invitation).toMatchObject({
          source: "member",
          depth: 3,
          role: "user",
          anonymous: true,
          locale: "es",
          expires_in_days: null,
          status: "pending",
        });

        const { rows: modules } = await query(
          c,
          "select module_key from public.invitation_modules where invitation_id = $1 order by module_key",
          [result.invitation.id],
        );
        // Public always inherits; a private module only when delegable.
        expect(modules.map((row) => row.module_key)).toEqual(["balances", "expenses"]);

        const { rows: categories } = await query(
          c,
          "select user_category_id from public.invitation_categories where invitation_id = $1",
          [result.invitation.id],
        );
        expect(categories.map((row) => row.user_category_id)).toEqual([cat]);

        const own = await listOwnInvitations(deps(c), caller);
        expect(own.quota.remaining).toBe(1); // base 2 - the one pending reservation
        expect(own.quota.pending_request).toBeNull();
        expect(own.invitations).toHaveLength(1);
        expect(own.invitations[0]).toMatchObject({ source: "member", path: null });
        expect(own.invitations[0]).not.toHaveProperty("token");

        await revokeOwnInvitation(deps(c), caller, result.invitation.id);
        const { rows: after } = await query(
          c,
          "select revoked_at from public.invitations where id = $1",
          [result.invitation.id],
        );
        expect(after[0]!.revoked_at).not.toBeNull();
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });

  it("two concurrent member invitations with one seat produce one 201 and one 409", async () => {
    const live = liveDeps();
    let inviterId = "";
    let original = "";
    try {
      await withClient(async (c) => {
        original = await getLevels(c);
        await setLevels(c, '[{"level":1,"quota":1}]');
        inviterId = await member(c, { name: "race-inviter", level: 1 });
      });

      const who: Caller = { kind: "session", userId: inviterId, role: "user" };
      const attempts = await Promise.allSettled([
        createMemberInvitation(live, who),
        createMemberInvitation(live, who),
      ]);

      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      const rejected = attempts.find((attempt) => attempt.status === "rejected");
      expect((rejected?.reason as { code?: string } | undefined)?.code).toBe(
        "invitation_quota_exhausted",
      );

      await withClient(async (c) => {
        const { rows } = await query(
          c,
          "select count(*)::int as n from public.invitations where created_by = $1",
          [inviterId],
        );
        expect(rows[0]!.n).toBe(1);
      });
    } finally {
      await withClient(async (c) => {
        await query(c, "delete from public.invitations where created_by = $1", [inviterId]);
        if (inviterId) {
          await query(c, "delete from public.profiles where id = $1", [inviterId]);
          await query(c, "delete from auth.users where id = $1", [inviterId]);
        }
        if (original) await setLevels(c, original);
      });
    }
  });
});

describe("join codes", () => {
  it("mints a code, previews it and exchanges it once for a 15min invitation", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, DEFAULT_LEVELS);
        const inviter = await member(c, { name: "qr-inviter", level: 1 });
        await query(c, "update public.profiles set display_name = 'Eric' where id = $1", [inviter]);
        const caller: Caller = { kind: "session", userId: inviter, role: "user" };

        const code = await createJoinCode(deps(c), caller);
        expect(code.code).toMatch(/^027_join_/);
        expect(code.path).toBe(`/join/${code.code}`);

        const preview = await previewJoinCode(deps(c), code.code);
        expect(preview).toMatchObject({ state: "pending", inviter_name: "Eric" });
        expect(typeof preview.instance_name).toBe("string");

        const exchanged = await exchangeJoinCode(deps(c), code.code);
        expect(exchanged.token).toMatch(/^027_inv_/);
        expect(exchanged.path).toBe(`/invite/${exchanged.token}`);

        // The minted invitation is a QR mint.
        const { rows: mint } = await query(
          c,
          "select source, created_by from public.invitations where created_by = $1 and source = 'qr'",
          [inviter],
        );
        expect(mint).toHaveLength(1);
        expect(mint[0]).toMatchObject({ source: "qr" });

        // A second exchange can never replay the token.
        await expect(exchangeJoinCode(deps(c), code.code)).rejects.toMatchObject({
          code: "join_code_used",
        });
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });
});

describe("anonymous redemption", () => {
  it("redeems an anonymous invitation and records the inherited package", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, DEFAULT_LEVELS);
        const inviter = await member(c, { name: "redeem-inviter", level: 2 });
        await query(c, "update public.profiles set locale = 'es' where id = $1", [inviter]);
        await moduleWith(c, "expenses", { isPublic: true, delegable: false });
        await grantModule(c, inviter, "expenses");
        const cat = await category(c, inviter);
        await query(
          c,
          "insert into public.user_category_members (user_category_id, user_id) values ($1, $2)",
          [cat, inviter],
        );

        const caller: Caller = { kind: "session", userId: inviter, role: "user" };
        const minted = await createMemberInvitation(deps(c), caller);

        // The anonymous link previews without an email and requires identity.
        const preview = await previewInvitation(redeemDeps(c), minted.token);
        expect(preview).toMatchObject({
          requires_identity: true,
          email: null,
          name: null,
          account_exists: false,
        });

        // Redeem with the name and email the invitee filled in.
        const inviteeEmail = email("invitee");
        const result = await redeemInvitation(redeemDeps(c), minted.token, {
          email: inviteeEmail,
          name: "Invitada",
          password: "correct-horse-battery",
        });

        const { rows: profileRows } = await query(
          c,
          "select invited_by, invite_level, display_name from public.profiles where id = $1",
          [result.user.id],
        );
        expect(profileRows[0]).toMatchObject({
          invited_by: inviter,
          invite_level: 3,
          display_name: "Invitada",
        });

        // The inherited categories and modules are materialised.
        const { rows: cats } = await query(
          c,
          "select user_category_id from public.user_category_members where user_id = $1",
          [result.user.id],
        );
        expect(cats.map((row) => row.user_category_id)).toEqual([cat]);

        const { rows: mods } = await query(
          c,
          "select module_key from public.user_modules where user_id = $1",
          [result.user.id],
        );
        expect(mods.map((row) => row.module_key)).toEqual(["expenses"]);

        // The invitation is consumed and names its redeemer.
        const { rows: inv } = await query(
          c,
          "select used_at, redeemed_by from public.invitations where id = $1",
          [minted.invitation.id],
        );
        expect(inv[0]!.used_at).not.toBeNull();
        expect(inv[0]!.redeemed_by).toBe(result.user.id);
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });

  it("keeps an existing account's level and inviter on an anonymous redemption", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, DEFAULT_LEVELS);
        const inviter = await member(c, { name: "redeem-inviter", level: 2 });
        const minted = await createMemberInvitation(deps(c), {
          kind: "session",
          userId: inviter,
          role: "user",
        });

        // An existing account with its own level and a different inviter.
        const existingEmail = email("existing");
        const existing = await createTestUser(c, { email: existingEmail });
        const otherInviter = await member(c, { name: "other-inviter", level: 1 });
        await query(
          c,
          "update public.profiles set invite_level = 7, invited_by = $2 where id = $1",
          [existing.id, otherInviter],
        );

        await redeemInvitation(
          redeemDeps(c),
          minted.token,
          { email: existingEmail },
          { kind: "session", userId: existing.id, role: "user" },
        );

        const { rows } = await query(
          c,
          "select invite_level, invited_by from public.profiles where id = $1",
          [existing.id],
        );
        expect(rows[0]).toMatchObject({ invite_level: 7, invited_by: otherInviter });
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });
});

describe("quota requests and grants", () => {
  it("requests out of seats, approves once and records one grant and the resolved event", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, '[{"level":1,"quota":0}]');
        const requester = await member(c, { name: "requestor", level: 1 });
        await query(c, "update public.profiles set display_name = 'Eric' where id = $1", [requester]);
        const admin = await createTestUser(c, { email: email("admin"), role: "admin" });
        await query(c, "update public.profiles set display_name = 'Ada' where id = $1", [admin.id]);

        const caller: Caller = { kind: "session", userId: requester, role: "user" };
        const request = await requestInvitationQuota(deps(c), caller, { amount: 3, reason: "family" });
        expect(request).toMatchObject({
          state: "pending",
          amount: 3,
          reason: "family",
          requester: { id: requester, display_name: "Eric", level: 1 },
        });

        // One pending per member.
        await expect(
          requestInvitationQuota(deps(c), caller, { amount: 2 }),
        ).rejects.toMatchObject({ code: "request_pending" });

        const adminCaller: Caller = { kind: "session", userId: admin.id, role: "admin" };
        const approved = await approveInvitationRequest(deps(c), adminCaller, request.id, 5);
        expect(approved).toMatchObject({
          state: "approved",
          granted_amount: 5,
          resolved_by: { id: admin.id, display_name: "Ada" },
        });

        // Exactly one grant with the approved amount.
        const { rows: grants } = await query(
          c,
          "select amount, granted_by, request_id, revoked_at from public.invitation_quota_grants where user_id = $1",
          [requester],
        );
        expect(grants).toHaveLength(1);
        expect(grants[0]).toMatchObject({ amount: 5, request_id: request.id, revoked_at: null });

        // The resolved event reached the requester with a push, never an email.
        const { rows: events } = await query(
          c,
          "select target, subject_id, resource, notify from public.event_outbox where type = 'invitation.request_resolved' and resource->>'request_id' = $1",
          [request.id],
        );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ target: "user", subject_id: requester, notify: ["push"] });
        expect(events[0].resource).toMatchObject({ request_id: request.id, state: "approved", amount: 5 });

        // The member's own list shows the resolved request and the new quota.
        const own = await listOwnInvitations(deps(c), caller);
        expect(own.quota.pending_request).toBeNull();
        expect(own.quota.granted).toBe(5);
        expect(own.requests).toHaveLength(1);
        expect(own.requests[0]).toMatchObject({ id: request.id, state: "approved", granted_amount: 5 });
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });

  it("rejects and cancels with a reason and never grants", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        await setLevels(c, '[{"level":1,"quota":0}]');
        const requester = await member(c, { name: "rejectee", level: 1 });
        const admin = await createTestUser(c, { email: email("reject-admin"), role: "admin" });
        const caller: Caller = { kind: "session", userId: requester, role: "user" };
        const adminCaller: Caller = { kind: "session", userId: admin.id, role: "admin" };

        const rejected = await requestInvitationQuota(deps(c), caller, { amount: 3 });
        const afterReject = await rejectInvitationRequest(deps(c), adminCaller, rejected.id, "not now");
        expect(afterReject).toMatchObject({ state: "rejected", resolution_reason: "not now", granted_amount: null });

        // Rejected means the member may ask again.
        const second = await requestInvitationQuota(deps(c), caller, { amount: 4 });
        await cancelInvitationRequest(deps(c), caller, second.id);
        const { rows: cancelled } = await query(
          c,
          "select state from public.invitation_requests where id = $1",
          [second.id],
        );
        expect(cancelled[0]).toMatchObject({ state: "cancelled" });

        // Neither a reject nor a cancel ever creates a grant.
        const { rows: grants } = await query(
          c,
          "select count(*)::int as n from public.invitation_quota_grants where user_id = $1",
          [requester],
        );
        expect(grants[0]).toMatchObject({ n: 0 });
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });

  it("two concurrent approvals create one grant", async () => {
    const live = liveDeps();
    let requester = "";
    let adminId = "";
    let requestId = "";
    let original = "";
    try {
      await withClient(async (c) => {
        original = await getLevels(c);
        await setLevels(c, '[{"level":1,"quota":0}]');
        requester = await member(c, { name: "race-requestor", level: 1 });
        adminId = (await createTestUser(c, { email: email("race-admin"), role: "admin" })).id;
      });

      const who: Caller = { kind: "session", userId: requester, role: "user" };
      requestId = (await requestInvitationQuota(live, who, { amount: 3 })).id;

      const admin: Caller = { kind: "session", userId: adminId, role: "admin" };
      const attempts = await Promise.allSettled([
        approveInvitationRequest(live, admin, requestId, 4),
        approveInvitationRequest(live, admin, requestId, 6),
      ]);

      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      const rejected = attempts.find((attempt) => attempt.status === "rejected");
      expect((rejected?.reason as { code?: string } | undefined)?.code).toBe("request_resolved");

      await withClient(async (c) => {
        const { rows: grants } = await query(
          c,
          "select amount from public.invitation_quota_grants where request_id = $1",
          [requestId],
        );
        expect(grants).toHaveLength(1);
      });
    } finally {
      await withClient(async (c) => {
        if (requestId) {
          await query(c, "delete from public.event_outbox where resource->>'request_id' = $1", [requestId]);
          await query(c, "delete from public.invitation_quota_grants where request_id = $1", [requestId]);
          await query(c, "delete from public.invitation_requests where id = $1", [requestId]);
        }
        for (const id of [requester, adminId]) {
          if (!id) continue;
          await query(c, "delete from public.profiles where id = $1", [id]);
          await query(c, "delete from auth.users where id = $1", [id]);
        }
        if (original) await setLevels(c, original);
      });
    }
  });

  it("grants directly, lists and revokes without deleting history", async () => {
    await withClient(async (c) => {
      await c.query("BEGIN");
      try {
        const grantee = await member(c, { name: "grantee", level: 1 });
        const admin = await createTestUser(c, { email: email("grant-admin"), role: "admin" });
        await query(c, "update public.profiles set display_name = 'Ada' where id = $1", [admin.id]);

        const adminCaller: Caller = { kind: "session", userId: admin.id, role: "admin" };
        const grant = await grantInvitationQuota(deps(c), adminCaller, grantee, {
          amount: 4,
          reason: "gift",
        });
        expect(grant).toMatchObject({
          user_id: grantee,
          amount: 4,
          reason: "gift",
          granted_by: { id: admin.id, display_name: "Ada" },
          request_id: null,
          revoked_at: null,
        });

        const listed = await listInvitationGrants(deps(c), grantee);
        expect(listed).toHaveLength(1);
        expect(listed[0].id).toBe(grant.id);

        await revokeInvitationGrant(deps(c), adminCaller, grantee, grant.id);

        // Revocation keeps history: the row is still there, only marked.
        const after = await listInvitationGrants(deps(c), grantee);
        expect(after).toHaveLength(1);
        expect(after[0].id).toBe(grant.id);
        expect(after[0].revoked_at).not.toBeNull();
      } finally {
        await c.query("ROLLBACK");
      }
    });
  });
});
