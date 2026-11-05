import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "../errors";
import { enqueueEvent } from "../realtime/service";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

/**
 * Invitations (core-data-model §3.4, auth spec §3): the only self-service way
 * into the instance. The token is shown once at creation and stored only as
 * SHA-256; redemption is single-use and materialises the category membership
 * and the invitation's module grants.
 */
export interface InvitationsDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
  auth: InvitationsAuth;
  now?: () => Date;
}

/** Supabase Auth port; the admin adapter creates/reads Auth users. */
export interface InvitationsAuth {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: { email: string; password: string; displayName: string }): Promise<{
    id: string;
    created: boolean;
  }>;
  deleteUser(userId: string): Promise<void>;
}

export type InvitationStatus = "pending" | "used" | "expired" | "revoked";

export type InvitationView = {
  id: string;
  email: string;
  name: string;
  user_category_id: string | null;
  modules: string[];
  status: InvitationStatus;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export interface CreateInvitationInput {
  email: string;
  name: string;
  user_category_id?: string | null;
  modules?: string[];
  expires_in_days?: number;
}

export interface RedeemInput {
  email: string;
  password: string;
  display_name?: string;
}

export type RedeemResult = {
  user: { id: string; email: string; display_name: string };
  invitation_id: string;
};

const TOKEN_PREFIX = "027_inv_";
const DEFAULT_TTL_DAYS = 7;
const MAX_TTL_DAYS = 365;
const MODULE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");
const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newInvitationToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

function actorFor(caller: Caller): { by: string | null; byKey: string | null } {
  if (caller.kind === "session") return { by: caller.userId, byKey: null };
  if (caller.kind === "service" || caller.kind === "delegated") {
    return { by: null, byKey: caller.keyId };
  }
  throw new DomainError("unauthorized");
}

function moduleKeys(values: string[] | undefined): string[] {
  const unique = [...new Set(values ?? [])].sort();
  for (const value of unique) {
    if (!MODULE_KEY.test(value)) {
      throw new DomainError("validation_failed", "invalid module key");
    }
  }
  return unique;
}

function ttlDays(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TTL_DAYS;
  if (!Number.isInteger(value) || value < 1 || value > MAX_TTL_DAYS) {
    throw new DomainError("validation_failed", "expires_in_days must be an integer between 1 and 365");
  }
  return value;
}

async function withTx<T>(
  deps: InvitationsDeps,
  fn: (db: QueryClient) => Promise<T>,
): Promise<T> {
  if (!deps.withTransaction) return fn(deps.db);
  return deps.withTransaction(async (db) => {
    await db.query("BEGIN");
    try {
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (err) {
      await db.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

async function modulesFor(db: QueryClient, invitationId?: string): Promise<Map<string, string[]>> {
  const { rows } = invitationId
    ? await db.query(
        `select invitation_id, module_key from public.invitation_modules
          where invitation_id = $1 order by module_key asc`,
        [invitationId],
      )
    : await db.query(
        "select invitation_id, module_key from public.invitation_modules order by module_key asc",
      );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const id = String(row.invitation_id);
    map.set(id, [...(map.get(id) ?? []), String(row.module_key)]);
  }
  return map;
}

function statusOf(row: Record<string, unknown>, now: Date): InvitationStatus {
  if (row.used_at !== null && row.used_at !== undefined) return "used";
  if (row.revoked_at !== null && row.revoked_at !== undefined) return "revoked";
  return new Date(String(row.expires_at)).getTime() <= now.getTime() ? "expired" : "pending";
}

function toView(row: Record<string, unknown>, modules: string[], now: Date): InvitationView {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    user_category_id: row.user_category_id === null ? null : String(row.user_category_id),
    modules,
    status: statusOf(row, now),
    expires_at: toIso(row.expires_at),
    used_at: toIsoOrNull(row.used_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    created_at: toIso(row.created_at),
  };
}

async function assertCategory(db: QueryClient, categoryId: string): Promise<void> {
  const { rows } = await db.query("select 1 from public.user_categories where id = $1", [categoryId]);
  if (!rows[0]) throw new DomainError("not_found");
}

export async function createInvitation(
  deps: InvitationsDeps,
  caller: Caller,
  input: CreateInvitationInput,
): Promise<{ invitation: InvitationView; token: string }> {
  const actor = actorFor(caller);
  const modules = moduleKeys(input.modules);
  const days = ttlDays(input.expires_in_days);
  const now = deps.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const token = newInvitationToken();

  if (input.user_category_id) await assertCategory(deps.db, input.user_category_id);

  const invitationId = await withTx(deps, async (db) => {
    const { rows } = await db
      .query(
        `insert into public.invitations
           (email, name, user_category_id, token_hash, expires_at, created_by, created_by_key)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id`,
        [
          normalizeEmail(input.email),
          input.name.trim(),
          input.user_category_id ?? null,
          hashInvitationToken(token),
          expiresAt.toISOString(),
          actor.by,
          actor.byKey,
        ],
      )
      .catch((err: { code?: string }) => {
        // The category vanished between the check and the insert.
        if (err.code === "23503") throw new DomainError("not_found");
        throw err;
      });

    const id = String(rows[0]?.id);
    if (modules.length > 0) {
      await db.query(
        `insert into public.invitation_modules (invitation_id, module_key)
         select $1, unnest($2::text[])`,
        [id, modules],
      );
    }
    await enqueueEvent(db, {
      type: "invitation.created",
      target: "admins",
      resource: {
        email: normalizeEmail(input.email),
        name: input.name.trim(),
        user_category_id: input.user_category_id ?? null,
        modules,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      },
    });
    return id;
  });

  const { rows } = await deps.db.query(
    `select id, email, name, user_category_id, expires_at, used_at, revoked_at, created_at
       from public.invitations where id = $1`,
    [invitationId],
  );
  return { invitation: toView(rows[0]!, modules, now), token };
}

export async function listInvitations(deps: InvitationsDeps): Promise<InvitationView[]> {
  const { rows } = await deps.db.query(
    `select id, email, name, user_category_id, expires_at, used_at, revoked_at, created_at
       from public.invitations
      order by created_at desc, id desc`,
  );
  const modules = await modulesFor(deps.db);
  const now = deps.now?.() ?? new Date();
  return rows.map((row) => toView(row, modules.get(String(row.id)) ?? [], now));
}

export async function revokeInvitation(deps: InvitationsDeps, id: string): Promise<void> {
  const { rows } = await deps.db.query(
    `update public.invitations set revoked_at = now()
      where id = $1 and used_at is null and revoked_at is null
      returning id`,
    [id],
  );
  if (rows[0]) return;

  const { rows: existing } = await deps.db.query(
    "select used_at, revoked_at from public.invitations where id = $1",
    [id],
  );
  const row = existing[0];
  if (!row) throw new DomainError("not_found");
  if (row.used_at !== null && row.used_at !== undefined) {
    throw new DomainError("invitation_used");
  }
  // Already revoked: revocation is idempotent.
}

/** Rejects a token that cannot be redeemed right now. */
function assertRedeemable(row: Record<string, unknown>, email: string, now: Date): void {
  if (row.used_at !== null && row.used_at !== undefined) throw new DomainError("invitation_used");
  if (row.revoked_at !== null && row.revoked_at !== undefined) throw new DomainError("not_found");
  if (new Date(String(row.expires_at)).getTime() <= now.getTime()) {
    throw new DomainError("invitation_expired");
  }
  if (email !== String(row.email)) {
    // The invitation is bound to its email; a different address does not proceed.
    throw new DomainError("validation_failed", "The email does not match the invitation");
  }
}

/** Single-use redemption (public). The invitation row is locked while redeeming. */
export async function redeemInvitation(
  deps: InvitationsDeps,
  token: string,
  input: RedeemInput,
): Promise<RedeemResult> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) throw new DomainError("not_found");
  const tokenHash = hashInvitationToken(token);
  const email = normalizeEmail(input.email);
  const now = () => deps.now?.() ?? new Date();

  // Preflight without locks: fail fast before touching Auth. The shared pool
  // must not be held during the external Auth HTTP call.
  const { rows: preview } = await deps.db.query(
    `select id, email, name, expires_at, used_at, revoked_at
       from public.invitations where token_hash = $1`,
    [tokenHash],
  );
  const pre = preview[0];
  if (!pre) throw new DomainError("not_found");
  assertRedeemable(pre, email, now());

  const displayName = (input.display_name?.trim() || String(pre.name)).slice(0, 80);
  let userId: string;
  let createdUserId: string | null = null;
  const existing = await deps.auth.findUserByEmail(email);
  if (existing) {
    userId = existing.id;
  } else {
    const created = await deps.auth.createUser({
      email,
      password: input.password,
      displayName,
    });
    userId = created.id;
    // Only delete users this call actually created; a concurrent redemption
    // may have registered the same email first.
    createdUserId = created.created ? created.id : null;
  }

  try {
    return await withTx(deps, async (db) => {
      const { rows } = await db.query(
        `select id, email, name, user_category_id, expires_at, used_at, revoked_at,
                created_by, created_by_key
           from public.invitations
          where token_hash = $1
          for update`,
        [tokenHash],
      );
      const invitation = rows[0];
      if (!invitation) throw new DomainError("not_found");
      // Authoritative re-check under the row lock: a concurrent redemption may
      // have won while the Auth user was being created.
      assertRedeemable(invitation, email, now());

      const { rows: profile } = await db.query(
        "select deactivated_at from public.profiles where id = $1",
        [userId],
      );
      const deactivated = profile[0]?.deactivated_at;
      if (deactivated !== null && deactivated !== undefined) {
        throw new DomainError("conflict", "That account is deactivated");
      }

      const invitationId = String(invitation.id);

      await db.query(
        `insert into public.profiles (id, display_name, role)
         values ($1, $2, 'user')
         on conflict (id) do nothing`,
        [userId, displayName],
      );

      if (invitation.user_category_id) {
        await db.query(
          `insert into public.user_category_members (user_category_id, user_id)
           values ($1, $2) on conflict do nothing`,
          [invitation.user_category_id, userId],
        );
      }

      await db.query(
        `insert into public.user_modules (user_id, module_key, granted_by, granted_by_key)
         select $1, m.module_key, $2, $3
           from public.invitation_modules m
          where m.invitation_id = $4
         on conflict (user_id, module_key) do update
           set revoked_at = null,
               granted_by = excluded.granted_by,
               granted_by_key = excluded.granted_by_key`,
        [userId, invitation.created_by, invitation.created_by_key, invitationId],
      );

      await db.query(
        "update public.invitations set used_at = now() where id = $1 and used_at is null",
        [invitationId],
      );
      await enqueueEvent(db, {
        type: "invitation.redeemed",
        target: "admins",
        resource: { id: invitationId, email: String(invitation.email), name: String(invitation.name) },
        payload: { user_id: userId },
      });

      // Existing accounts keep their stored name; new ones use the invite name.
      const { rows: profileRows } = await db.query(
        "select display_name from public.profiles where id = $1",
        [userId],
      );

      return {
        user: {
          id: userId,
          email,
          display_name: String(profileRows[0]?.display_name ?? displayName),
        },
        invitation_id: invitationId,
      };
    });
  } catch (err) {
    // Never leave an Auth user behind when the database transaction fails.
    if (createdUserId) await deps.auth.deleteUser(createdUserId).catch(() => undefined);
    throw err;
  }
}
