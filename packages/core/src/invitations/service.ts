import { createHash, randomBytes } from "node:crypto";
import { DomainError } from "../errors";
import { enqueueEvent } from "../realtime/service";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { isEmailLocale, type EmailLocale } from "../email/types";

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

/** `all` is the explicit "no status filter"; every list defaults to it. */
export type InvitationStatusFilter = InvitationStatus | "all";

export type InvitationView = {
  id: string;
  email: string;
  name: string;
  user_category_id: string | null;
  modules: string[];
  status: InvitationStatus;
  locale: EmailLocale;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  mode: "sent" | "failed" | "not_sent";
  email_sent_at: string | null;
  email_failed_at: string | null;
  email_error: string | null;
  created_at: string;
};

/** Detail view: the list representation plus who created the invitation. */
export type InvitationDetail = InvitationView & {
  created_by: { id: string; display_name: string } | null;
};

export interface CreateInvitationInput {
  email: string;
  name: string;
  user_category_id?: string | null;
  modules?: string[];
  expires_in_days?: number;
  /** Locale of the email; defaults to the instance's default locale. */
  locale?: EmailLocale;
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

/** One page of invitations plus the total across every page. */
export interface InvitationList {
  invitations: InvitationView[];
  total: number;
}

export interface InvitationPage {
  limit: number;
  offset: number;
  /** Derived status filter; omitted means `all`. */
  status?: InvitationStatusFilter;
}

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

async function modulesFor(
  db: QueryClient,
  invitationIds?: readonly string[],
): Promise<Map<string, string[]>> {
  if (invitationIds && invitationIds.length === 0) return new Map();
  const { rows } = invitationIds
    ? await db.query(
        `select invitation_id, module_key from public.invitation_modules
          where invitation_id = any($1::uuid[]) order by module_key asc`,
        [invitationIds],
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

function emailState(row: Record<string, unknown>): InvitationView["mode"] {
  if (row.email_sent_at !== null && row.email_sent_at !== undefined) return "sent";
  if (row.email_failed_at !== null && row.email_failed_at !== undefined) return "failed";
  return "not_sent";
}

function toView(row: Record<string, unknown>, modules: string[], now: Date): InvitationView {
  const locale = isEmailLocale(row.locale) ? row.locale : "en";
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    user_category_id: row.user_category_id === null ? null : String(row.user_category_id),
    modules,
    status: statusOf(row, now),
    locale,
    expires_at: toIso(row.expires_at),
    used_at: toIsoOrNull(row.used_at),
    revoked_at: toIsoOrNull(row.revoked_at),
    mode: emailState(row),
    email_sent_at: toIsoOrNull(row.email_sent_at),
    email_failed_at: toIsoOrNull(row.email_failed_at),
    email_error: row.email_error === null || row.email_error === undefined ? null : String(row.email_error),
    created_at: toIso(row.created_at),
  };
}

async function assertCategory(db: QueryClient, categoryId: string): Promise<void> {
  const { rows } = await db.query("select 1 from public.user_categories where id = $1", [categoryId]);
  if (!rows[0]) throw new DomainError("not_found");
}

function readSettingString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Initial preferences for a profile created by redemption (task-07 debt M2b):
 * the wizard's localization is the instance default, so a new member must not
 * start on hardcoded `en`/`UTC`. Missing rows or null values keep the column
 * defaults; a partially configured instance falls back per key.
 */
async function defaultProfileLocalization(
  db: QueryClient,
): Promise<{ locale: string; timezone: string }> {
  const { rows } = await db.query(
    "select key, value from public.settings where key = any($1::text[])",
    [["localization.default_locale", "localization.timezone"]],
  );
  const values = new Map<string, unknown>();
  for (const row of rows) values.set(String(row.key), row.value);
  return {
    locale: readSettingString(values.get("localization.default_locale")) ?? "en",
    timezone: readSettingString(values.get("localization.timezone")) ?? "UTC",
  };
}

/** Requested locale, or the instance default when the form leaves it out. */
async function invitationLocale(db: QueryClient, requested?: EmailLocale): Promise<EmailLocale> {
  if (requested !== undefined) {
    if (!isEmailLocale(requested)) throw new DomainError("validation_failed", "invalid locale");
    return requested;
  }
  const { rows } = await db.query(
    "select value from public.settings where key = $1",
    ["localization.default_locale"],
  );
  const value = rows[0]?.value;
  return isEmailLocale(value) ? value : "en";
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
  const email = normalizeEmail(input.email);
  const locale = await invitationLocale(deps.db, input.locale);

  if (input.user_category_id) await assertCategory(deps.db, input.user_category_id);

  // An account cannot be invited again: redemption would only reattach it.
  const existingUser = await deps.auth.findUserByEmail(email);
  if (existingUser) {
    throw new DomainError("conflict", "That email already belongs to a member", {
      code: "email_registered",
    });
  }

  const invitationId = await withTx(deps, async (db) => {
    // The check and the insert share the transaction, and the advisory lock
    // serialises creates for the same email: two concurrent requests cannot
    // both see "no pending invitation" and insert twice.
    await db.query("select pg_advisory_xact_lock(hashtext($1))", [`invitation:${email}`]);
    const { rows: pending } = await db.query(
      `select 1 from public.invitations
        where email = $1
          and used_at is null
          and revoked_at is null
          and expires_at > $2
        limit 1`,
      [email, now.toISOString()],
    );
    if (pending[0]) {
      throw new DomainError("conflict", "That email already has a pending invitation", {
        code: "pending_invitation",
      });
    }

    const { rows } = await db
      .query(
        `insert into public.invitations
           (email, name, user_category_id, token_hash, locale, expires_at, created_by, created_by_key)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning id`,
        [
          email,
          input.name.trim(),
          input.user_category_id ?? null,
          hashInvitationToken(token),
          locale,
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
        email,
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
    `select id, email, name, user_category_id, locale, expires_at, used_at, revoked_at,
            email_sent_at, email_failed_at, email_error, created_at
       from public.invitations where id = $1`,
    [invitationId],
  );
  return { invitation: toView(rows[0]!, modules, now), token };
}

export async function listInvitations(
  deps: InvitationsDeps,
  page: InvitationPage,
): Promise<InvitationList> {
  const now = deps.now?.() ?? new Date();
  const status = page.status ?? "all";
  // One CTE filters and the next counts: `total` reflects the filter, so the
  // paginator and the panel agree on how many rows the list really has.
  const { rows } = await deps.db.query(
    `with filtered as (
       select id, email, name, user_category_id, locale, expires_at, used_at, revoked_at,
              email_sent_at, email_failed_at, email_error, created_at
         from public.invitations
        where $3::text = 'all'
           or ($3::text = 'used' and used_at is not null)
           or ($3::text = 'revoked' and used_at is null and revoked_at is not null)
           or ($3::text = 'pending'
               and used_at is null and revoked_at is null and expires_at > $4::timestamptz)
           or ($3::text = 'expired'
               and used_at is null and revoked_at is null and expires_at <= $4::timestamptz)
     ),
     total as (select count(*)::int as n from filtered),
     page as (
       select * from filtered
        order by created_at desc, id desc
        limit $1 offset $2
     )
     select total.n as total, page.*
       from total left join page on true`,
    [page.limit, page.offset, status, now.toISOString()],
  );
  const invitations = rows.filter((row) => row.id !== null && row.id !== undefined);
  const modules = await modulesFor(
    deps.db,
    invitations.map((row) => String(row.id)),
  );
  return {
    invitations: invitations.map((row) =>
      toView(row, modules.get(String(row.id)) ?? [], now),
    ),
    total: Number(rows[0]?.total ?? 0),
  };
}

/** One invitation with its creator; never the token nor its hash. */
export async function getInvitation(
  deps: InvitationsDeps,
  id: string,
): Promise<InvitationDetail> {
  const now = deps.now?.() ?? new Date();
  const { rows } = await deps.db.query(
    `select i.id, i.email, i.name, i.user_category_id, i.locale, i.expires_at, i.used_at,
            i.revoked_at, i.email_sent_at, i.email_failed_at, i.email_error,
            i.created_at, p.id as created_by_id, p.display_name as created_by_display_name
       from public.invitations i
       left join public.profiles p on p.id = i.created_by
      where i.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  const invitationId = String(row.id);
  const modules = await modulesFor(deps.db, [invitationId]);
  // `created_by` is null for a key (instance) actor: the caller labels it.
  const creator =
    row.created_by_id === null || row.created_by_id === undefined
      ? null
      : {
          id: String(row.created_by_id),
          display_name: String(row.created_by_display_name),
        };
  return { ...toView(row, modules.get(invitationId) ?? [], now), created_by: creator };
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

/** Still-pending check shared by the resend and link actions. */
function assertPending(row: Record<string, unknown>, now: Date): void {
  if (row.used_at !== null && row.used_at !== undefined) throw new DomainError("invitation_used");
  // A revoked invitation is indistinguishable from a missing one on purpose.
  if (row.revoked_at !== null && row.revoked_at !== undefined) throw new DomainError("not_found");
  if (new Date(String(row.expires_at)).getTime() <= now.getTime()) {
    throw new DomainError("invitation_expired");
  }
}

export interface RotatedInvitation {
  invitation: InvitationView;
  token: string;
}

/**
 * Issues a new token for a pending invitation and invalidates the previous one.
 * Used by both "resend" and "generate a new link": the database only keeps the
 * hash, so the original link can never be recovered.
 */
export async function rotateInvitationToken(
  deps: InvitationsDeps,
  id: string,
  now: Date = deps.now?.() ?? new Date(),
): Promise<RotatedInvitation> {
  const token = newInvitationToken();
  const tokenHash = hashInvitationToken(token);

  const row = await withTx(deps, async (db) => {
    const { rows } = await db.query(
      `select id, email, name, user_category_id, locale, expires_at, used_at, revoked_at,
              email_sent_at, email_failed_at, email_error, created_at
         from public.invitations where id = $1 for update`,
      [id],
    );
    const current = rows[0];
    if (!current) throw new DomainError("not_found");
    assertPending(current, now);
    await db.query("update public.invitations set token_hash = $1 where id = $2", [tokenHash, id]);
    return current;
  });

  const modules = await modulesFor(deps.db, [id]);
  return { invitation: toView(row, modules.get(id) ?? [], now), token };
}

export interface EmailAttempt {
  status: "sent" | "failed";
  code?: string;
}

/** Records the last email attempt; `email_error` is a short code, never a body. */
export async function recordEmailAttempt(
  deps: InvitationsDeps,
  id: string,
  attempt: EmailAttempt,
): Promise<void> {
  if (attempt.status === "sent") {
    await deps.db.query(
      `update public.invitations
          set email_sent_at = now(), email_failed_at = null, email_error = null
        where id = $1`,
      [id],
    );
    return;
  }
  await deps.db.query(
    "update public.invitations set email_failed_at = now(), email_error = $2 where id = $1",
    [id, (attempt.code ?? "email_failed").slice(0, 64)],
  );
}

export const RESEND_COOLDOWN_MS = 60_000;

/** Seconds left before the invitation may send another email (0 when ready). */
export function resendCooldownSeconds(invitation: InvitationView, now: Date): number {
  const attempts = [invitation.email_sent_at, invitation.email_failed_at]
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));
  if (attempts.length === 0) return 0;
  const remaining = Math.max(...attempts) + RESEND_COOLDOWN_MS - now.getTime();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
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

      // The wizard's localization seeds the profile instead of `en`/`UTC`.
      const localization = await defaultProfileLocalization(db);
      await db.query(
        `insert into public.profiles (id, display_name, role, locale, timezone)
         values ($1, $2, 'user', $3, $4)
         on conflict (id) do nothing`,
        [userId, displayName, localization.locale, localization.timezone],
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
