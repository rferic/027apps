import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestModule, createTestUser, query, withClient } from "../pg.js";
import {
  createInvitationRoute,
  invitationsRoute,
  redeemInvitationRoute,
  revokeInvitationRoute,
  type InvitationsRouteDeps,
} from "@027apps/core/invitations/api.js";
import type { InvitationsAuth } from "@027apps/core/invitations/service.js";
import type { Caller, DoorDeps, LogEntry } from "@027apps/core/api/types.js";

const email = (name: string) => `inv-api-${name}-${Date.now()}-${Math.random()}@test.local`;

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

async function createAuthUserOnly(c: ClientBase, value: string): Promise<string> {
  const id = crypto.randomUUID();
  await c.query(
    `insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
     values ($1, '00000000-0000-0000-0000-000000000000', $2, crypt('test-password', gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')`,
    [id, value],
  );
  return id;
}

function authPort(c: ClientBase): InvitationsAuth {
  const users = new Map<string, string>();
  return {
    async findUserByEmail(value) {
      return users.has(value) ? { id: users.get(value)! } : null;
    },
    async createUser({ email: value }) {
      const id = await createAuthUserOnly(c, value);
      users.set(value, id);
      return { id, created: true };
    },
    async deleteUser(userId) {
      await query(c, "delete from public.profiles where id = $1", [userId]);
      await query(c, "delete from auth.users where id = $1", [userId]);
    },
  };
}

function deps(c: ClientBase, who: Caller, logs: LogEntry[] = []): InvitationsRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: (entry) => logs.push(entry),
  };
  return {
    door,
    auth: async () => who,
    invitations: {
      db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
      auth: authPort(c),
    },
  };
}

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function adminCaller(c: ClientBase): Promise<Caller> {
  const { id } = await createTestUser(c, { email: email("admin"), role: "super_admin" });
  return { kind: "session", userId: id, role: "super_admin" };
}

describe("invitations API", () => {
  it("requires a session and an admin to manage invitations", async () => {
    await inRollback(async (c) => {
      const anon = await invitationsRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/invitations"),
      );
      expect(anon.status).toBe(401);

      const { id } = await createTestUser(c, { email: email("plain"), role: "user" });
      const plain = await invitationsRoute(deps(c, { kind: "session", userId: id, role: "user" }))(
        new Request("http://local/api/v1/invitations"),
      );
      expect(plain.status).toBe(403);
    });
  });

  it("creates an invitation once, lists it without the token and revokes it", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const logs: LogEntry[] = [];
      const route = deps(c, who, logs);

      const created = await createInvitationRoute(route)(
        new Request("http://local/api/v1/invitations", post({ email: email("new"), name: "New" })),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as {
        invitation: { id: string; status: string; modules: string[] };
        token: string;
      };
      expect(body.token.startsWith("027_inv_")).toBe(true);
      expect(body.invitation.status).toBe("pending");
      expect(body.invitation.modules).toEqual([]);

      const listed = await invitationsRoute(route)(new Request("http://local/api/v1/invitations"));
      const listBody = (await listed.json()) as { invitations: Record<string, unknown>[] };
      expect(listBody.invitations).toHaveLength(1);
      expect(listBody.invitations[0]).not.toHaveProperty("token");
      expect(listBody.invitations[0]).not.toHaveProperty("token_hash");

      const revoked = await revokeInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${body.invitation.id}`, { method: "DELETE" }),
        body.invitation.id,
      );
      expect(revoked.status).toBe(204);

      const again = await revokeInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${body.invitation.id}`, { method: "DELETE" }),
        body.invitation.id,
      );
      expect(again.status).toBe(204);

      // Secret hygiene: the token never reaches the logs.
      const serialized = JSON.stringify(logs);
      expect(serialized).not.toContain(body.token);
    });
  });

  it("rejects a malformed invitation id with 400", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const res = await revokeInvitationRoute(deps(c, who))(
        new Request("http://local/api/v1/invitations/not-a-uuid", { method: "DELETE" }),
        "not-a-uuid",
      );
      expect(res.status).toBe(400);
    });
  });

  it("redeems publicly once and returns domain errors afterwards", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const route = deps(c, who);
      const inviteEmail = email("redeem");

      const created = await createInvitationRoute(route)(
        new Request("http://local/api/v1/invitations", post({ email: inviteEmail, name: "Redeem" })),
      );
      const { token } = (await created.json()) as { token: string };

      const redeemed = await redeemInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${token}/redeem`, post({
          email: inviteEmail,
          password: "correct-horse-battery",
          display_name: "Redeem Real",
        })),
        token,
      );
      expect(redeemed.status).toBe(201);
      const redeemedBody = (await redeemed.json()) as {
        user: { id: string; display_name: string };
      };
      expect(redeemedBody.user.display_name).toBe("Redeem Real");

      const again = await redeemInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${token}/redeem`, post({
          email: inviteEmail,
          password: "correct-horse-battery",
        })),
        token,
      );
      expect(again.status).toBe(409);
      expect(((await again.json()) as { error: { code: string } }).error.code).toBe(
        "invitation_used",
      );
    });
  });

  it("maps a wrong email to 400 and an expired token to 409", async () => {
    await inRollback(async (c) => {
      const who = await adminCaller(c);
      const route = deps(c, who);

      const mismatchEmail = email("mismatch");
      const mismatch = await createInvitationRoute(route)(
        new Request("http://local/api/v1/invitations", post({ email: mismatchEmail, name: "M" })),
      );
      const { token: mismatchToken } = (await mismatch.json()) as { token: string };
      const wrong = await redeemInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${mismatchToken}/redeem`, post({
          email: email("other"),
          password: "correct-horse-battery",
        })),
        mismatchToken,
      );
      expect(wrong.status).toBe(400);

      const expiredEmail = email("expired");
      const expired = await createInvitationRoute(route)(
        new Request("http://local/api/v1/invitations", post({ email: expiredEmail, name: "E" })),
      );
      const expiredBody = (await expired.json()) as { invitation: { id: string }; token: string };
      await query(
        c,
        "update public.invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [expiredBody.invitation.id],
      );
      const late = await redeemInvitationRoute(route)(
        new Request(`http://local/api/v1/invitations/${expiredBody.token}/redeem`, post({
          email: expiredEmail,
          password: "correct-horse-battery",
        })),
        expiredBody.token,
      );
      expect(late.status).toBe(409);
      expect(((await late.json()) as { error: { code: string } }).error.code).toBe(
        "invitation_expired",
      );
    });
  });
});
