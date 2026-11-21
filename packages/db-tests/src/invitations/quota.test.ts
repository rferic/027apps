import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import type { QueryClient } from "@027apps/core/api/rate-limit-storage.js";
import { invitationQuota } from "@027apps/core/invitations/quota.js";
import {
  hashInvitationToken,
  redeemInvitation,
  type InvitationsAuth,
} from "@027apps/core/invitations/service.js";
import { deactivateUser, listUsers, purgeUser } from "@027apps/core/users/service.js";
import type { Caller } from "@027apps/core/api/types.js";

/**
 * Live quota against the real schema (sprint 18 spec §5.9 and §7.6): the
 * counting rules are SQL, so they are verified here, never in the unit fake.
 */
const email = (name: string) => `quota-${name}-${Date.now()}-${Math.random()}@test.local`;

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

const queryClient = (c: ClientBase): QueryClient => ({
  query: (sql: string, params: unknown[] = []) => query(c, sql, params),
});

const superAdmin = (userId: string): Caller => ({ kind: "session", userId, role: "super_admin" });

/** An account with a club level and, optionally, an inviter. */
async function member(
  c: ClientBase,
  opts: {
    name: string;
    role?: "super_admin" | "admin" | "user";
    level?: number | null;
    invitedBy?: string | null;
  },
): Promise<string> {
  const { id } = await createTestUser(c, { email: email(opts.name), role: opts.role ?? "user" });
  await query(c, "update public.profiles set invite_level = $2, invited_by = $3 where id = $1", [
    id,
    opts.level ?? null,
    opts.invitedBy ?? null,
  ]);
  return id;
}

type InvitationOptions = {
  source?: "admin" | "member" | "qr";
  email?: string | null;
  name?: string | null;
  expiresAt?: string;
};

/** A minted invitation; the token is only known here (the row keeps the hash). */
async function invitation(
  c: ClientBase,
  inviterId: string,
  opts: InvitationOptions = {},
): Promise<{ id: string; token: string }> {
  const token = `027_inv_${crypto.randomUUID()}`;
  const { rows } = await query(
    c,
    `insert into public.invitations
       (email, name, role, source, depth, token_hash, locale, expires_at, created_by)
     values ($1, $2, 'user', $3, 2, $4, 'en', coalesce($5::timestamptz, now() + interval '48 hours'), $6)
     returning id`,
    [
      opts.email ?? null,
      opts.name ?? null,
      opts.source ?? "member",
      hashInvitationToken(token),
      opts.expiresAt ?? null,
      inviterId,
    ],
  );
  return { id: String(rows[0]!.id), token };
}

async function joinCode(
  c: ClientBase,
  inviterId: string,
  opts: { expiresAt?: string } = {},
): Promise<{ id: string; code: string }> {
  const code = `joincode-${crypto.randomUUID()}`;
  const { rows } = await query(
    c,
    `insert into public.join_codes (inviter_id, code_hash, expires_at)
     values ($1, $2, coalesce($3::timestamptz, now() + interval '90 seconds'))
     returning id`,
    [inviterId, hashInvitationToken(code), opts.expiresAt ?? null],
  );
  return { id: String(rows[0]!.id), code };
}

/** Auth port with the accounts the test expects; creating one is a failure. */
function staticAuth(existing: Record<string, string> = {}): InvitationsAuth {
  return {
    async findUserByEmail(value) {
      return existing[value] ? { id: existing[value] } : null;
    },
    async createUser() {
      throw new Error("createUser must not run in this test");
    },
    async deleteUser() {
      throw new Error("deleteUser must not run in this test");
    },
  };
}

describe("invitation quota", () => {
  it("a deactivated invitee still occupies and a purged one frees the seat", async () => {
    await inRollback(async (c) => {
      const inviter = await member(c, { name: "inviter", level: 2 });
      const invitee = await member(c, { name: "invitee", level: 2, invitedBy: inviter });
      const db = queryClient(c);

      let quota = await invitationQuota(db, inviter);
      expect(quota).toMatchObject({
        level: 2,
        base: 2,
        granted: 0,
        used: 1,
        reserved: 0,
        remaining: 1,
        unlimited: false,
      });

      // The account exists even when it is deactivated: the seat stays taken.
      await query(c, "update public.profiles set deactivated_at = now() where id = $1", [invitee]);
      quota = await invitationQuota(db, inviter);
      expect(quota.used).toBe(1);
      expect(quota.remaining).toBe(1);

      // Purging deletes the row; `invited_by` on their own invitees is set to
      // null by the FK, so the seat simply disappears (spec §5.9 / §7.6).
      await query(c, "delete from auth.users where id = $1", [invitee]);
      quota = await invitationQuota(db, inviter);
      expect(quota.used).toBe(0);
      expect(quota.remaining).toBe(2);
    });
  });

  it("expired and revoked invitations release the reservation", async () => {
    await inRollback(async (c) => {
      const inviter = await member(c, { name: "reserver", level: 2 });
      const db = queryClient(c);
      const link = await invitation(c, inviter);
      const qr = await invitation(c, inviter, { source: "qr" });
      // An admin mint is not a member reservation.
      const adminMint = await invitation(c, inviter, { source: "admin", name: "Admin", email: email("mint") });

      let quota = await invitationQuota(db, inviter);
      expect(quota).toMatchObject({ base: 2, reserved: 2, remaining: 0 });

      await query(
        c,
        "update public.invitations set created_at = now() - interval '3 days', expires_at = now() - interval '1 minute' where id = $1",
        [link.id],
      );
      quota = await invitationQuota(db, inviter);
      expect(quota).toMatchObject({ reserved: 1, remaining: 1 });

      await query(c, "update public.invitations set revoked_at = now() where id = $1", [qr.id]);
      quota = await invitationQuota(db, inviter);
      expect(quota).toMatchObject({ reserved: 0, remaining: 2 });

      // A used invitation is no longer pending either.
      await query(c, "update public.invitations set used_at = now() where id = $1", [
        adminMint.id,
      ]);
      quota = await invitationQuota(db, inviter);
      expect(quota.reserved).toBe(0);
    });
  });

  it("a redemption over an existing account releases the reservation without counting a profile", async () => {
    await inRollback(async (c) => {
      const inviter = await member(c, { name: "redeem-inviter", level: 2 });
      const existingEmail = email("existing");
      const { id: existingId } = await createTestUser(c, { email: existingEmail });
      const inv = await invitation(c, inviter, { email: existingEmail, name: "Existing" });
      const db = queryClient(c);

      expect((await invitationQuota(db, inviter)).reserved).toBe(1);

      const result = await redeemInvitation(
        { db, auth: staticAuth({ [existingEmail]: existingId }) },
        inv.token,
        { email: existingEmail },
        { kind: "session", userId: existingId, role: "user" },
      );
      expect(result.user.id).toBe(existingId);

      // The invitation is consumed, and an existing account keeps its own
      // inviter: no new profile counts against the inviter.
      const quota = await invitationQuota(db, inviter);
      expect(quota).toMatchObject({ used: 0, reserved: 0, remaining: 2 });
      const { rows } = await query(c, "select invited_by from public.profiles where id = $1", [
        existingId,
      ]);
      expect(rows[0]!.invited_by).toBeNull();
    });
  });

  it("an administrator has no quota", async () => {
    await inRollback(async (c) => {
      const admin = await member(c, { name: "quota-admin", role: "admin" });

      const quota = await invitationQuota(queryClient(c), admin);

      expect(quota.unlimited).toBe(true);
      expect(quota.level).toBeNull();
      expect(quota.remaining).toBe(0);
    });
  });

  it("deactivating a member revokes their pending invitations and live join codes", async () => {
    await inRollback(async (c) => {
      const admin = await member(c, { name: "deactivate-admin", role: "super_admin" });
      const target = await member(c, { name: "deactivate-target", level: 2 });
      const invitee = await member(c, { name: "deactivate-invitee", invitedBy: target });
      await query(c, "insert into public.invitation_quota_grants (user_id, amount) values ($1, 2)", [
        target,
      ]);
      const link = await invitation(c, target);
      const code = await joinCode(c, target);
      const db = queryClient(c);

      // No `withTransaction`: the test already holds one, and deactivation's
      // own write path falls back to the client it was given.
      await deactivateUser({ db }, superAdmin(admin), target);

      const invitationRow = (
        await query(c, "select revoked_at from public.invitations where id = $1", [link.id])
      ).rows[0]!;
      expect(invitationRow.revoked_at).not.toBeNull();
      const codeRow = (
        await query(c, "select used_at from public.join_codes where id = $1", [code.id])
      ).rows[0]!;
      expect(codeRow.used_at).not.toBeNull();

      // The affected person's invitees and grants are untouched (spec §7.6).
      const inviteeRow = (
        await query(c, "select invited_by, deactivated_at from public.profiles where id = $1", [
          invitee,
        ])
      ).rows[0]!;
      expect(inviteeRow).toEqual({ invited_by: target, deactivated_at: null });
      const grant = (
        await query(c, "select revoked_at from public.invitation_quota_grants where user_id = $1", [
          target,
        ])
      ).rows[0]!;
      expect(grant.revoked_at).toBeNull();

      // The link that was live a moment ago answers 404: a revoked token is
      // indistinguishable from a missing one.
      await expect(
        redeemInvitation(
          { db, auth: staticAuth() },
          link.token,
          { email: email("nobody"), password: "correct-horse-battery" },
        ),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  it("purging a deactivated member revokes their links and leaves their invitees active", async () => {
    await inRollback(async (c) => {
      const admin = await member(c, { name: "purge-admin", role: "super_admin" });
      const target = await member(c, { name: "purge-target", level: 1 });
      const invitee = await member(c, { name: "purge-invitee", invitedBy: target });
      const link = await invitation(c, target);
      const code = await joinCode(c, target);
      await query(c, "update public.profiles set deactivated_at = now() where id = $1", [target]);

      await purgeUser({ db: queryClient(c) }, superAdmin(admin), target);

      expect(
        (await query(c, "select 1 from public.profiles where id = $1", [target])).rows,
      ).toHaveLength(0);

      const invitationRow = (
        await query(c, "select revoked_at, created_by from public.invitations where id = $1", [
          link.id,
        ])
      ).rows[0]!;
      expect(invitationRow.revoked_at).not.toBeNull();
      // The attribution is discarded, the audit row survives.
      expect(invitationRow.created_by).toBeNull();

      // The code fell with the profile: there is nothing left to exchange.
      expect((await query(c, "select 1 from public.join_codes where id = $1", [code.id])).rows).toHaveLength(
        0,
      );

      // No cascade on invitees (C8): the account stays, with no inviter left.
      const inviteeRow = (
        await query(c, "select invited_by, deactivated_at from public.profiles where id = $1", [
          invitee,
        ])
      ).rows[0]!;
      expect(inviteeRow).toEqual({ invited_by: null, deactivated_at: null });
    });
  });

  it("lists only the direct invitees of a member", async () => {
    await inRollback(async (c) => {
      const root = await member(c, { name: "tree-root", role: "super_admin" });
      const ana = await member(c, { name: "tree-ana", level: 1 });
      const luis = await member(c, { name: "tree-luis", level: 2, invitedBy: ana });
      const pablo = await member(c, { name: "tree-pablo", level: 3, invitedBy: luis });

      const direct = await listUsers({ db: queryClient(c) }, superAdmin(root), {
        invited_by: ana,
        state: "all",
        limit: 20,
        offset: 0,
      });

      expect(direct.users.map((user) => user.id)).toEqual([luis]);
      expect(direct.total).toBe(1);
      expect(direct.users[0]?.invitation_level).toBe(2);

      const tree = await listUsers({ db: queryClient(c) }, superAdmin(root), {
        invited_by: luis,
        state: "all",
        limit: 20,
        offset: 0,
      });
      expect(tree.users.map((user) => user.id)).toEqual([pablo]);
    });
  });
});
