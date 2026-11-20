import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { isEmailLocale, type EmailLocale } from "../email/types";
import { invitationQuota, type InvitationQuota } from "./quota";
import { hashInviteToken, newInviteToken, withInviteTx } from "./shared";
import { listOwnInvitationRequests, type InvitationRequestView } from "./requests";
import {
  getInvitation,
  type InvitationSource,
  type InvitationStatus,
  type InvitationsDeps,
  type InvitationView,
} from "./service";

/**
 * Member invitations (sprint 18 spec §6.2/§7.2): an anonymous link an active
 * member mints from their own quota. The package the invitee inherits is a
 * server-side snapshot, never something the inviter chooses: every category
 * plus the modules that are public or that an admin marked delegable.
 */

/** Default link lifetime, used when the setting is missing or unusable. */
export const MEMBER_TTL_MS = 48 * 60 * 60 * 1000;
const MEMBER_TTL_SETTING = "invitations.member_ttl_hours";
/** Mirrors the catalog bound (1..720); guards a value written outside the API. */
const MEMBER_TTL_MAX_HOURS = 720;
const INVITE_TOKEN_PREFIX = "027_inv_";

/**
 * Link lifetime from `invitations.member_ttl_hours`, in milliseconds. An admin
 * may change it in the panel; invitations already created keep the `expires_at`
 * they were minted with, so a change never revives or kills a live link. A
 * missing or unreadable value means the 48-hour default, never a zero TTL.
 */
async function memberTtlMs(db: QueryClient): Promise<number> {
  const { rows } = await db.query(
    "select value from public.settings where key = $1",
    [MEMBER_TTL_SETTING],
  );
  const stored = rows[0]?.value;
  const hours = typeof stored === "number" ? stored : Number(stored);
  if (!Number.isFinite(hours) || hours < 1 || hours > MEMBER_TTL_MAX_HOURS) return MEMBER_TTL_MS;
  return Math.round(hours) * 60 * 60 * 1000;
}

/** The access an invitee inherits from their inviter (spec §5.3/§7.7). */
export type InheritedPackage = { categories: string[]; modules: string[] };

/**
 * The inviter's effective package: every category they belong to, and every
 * active module grant that is `is_public` or `delegable`. A private,
 * non-delegable module is never inherited, even when the inviter holds it.
 */
export async function inheritPackage(
  db: QueryClient,
  inviterId: string,
): Promise<InheritedPackage> {
  const { rows: moduleRows } = await db.query(
    `select um.module_key
       from public.user_modules um
       join public.module_registry mr on mr.key = um.module_key
      where um.user_id = $1
        and um.revoked_at is null
        and (mr.is_public or mr.delegable)
      order by um.module_key`,
    [inviterId],
  );
  const { rows: categoryRows } = await db.query(
    `select user_category_id
       from public.user_category_members
      where user_id = $1
      order by user_category_id`,
    [inviterId],
  );
  return {
    modules: moduleRows.map((row) => String(row.module_key)),
    categories: categoryRows.map((row) => String(row.user_category_id)),
  };
}

/** The locale a member invitation stores: the inviter's profile, else English. */
function inviterLocale(row: Record<string, unknown>): EmailLocale {
  return isEmailLocale(row.locale) ? row.locale : "en";
}

/**
 * Depth the invitee will get: the inviter's level plus one. An admin inviter
 * (level NULL) is the root and its invitees are level 1.
 */
function depthOf(row: Record<string, unknown>): number {
  const level = row.invite_level;
  return (level === null || level === undefined ? 0 : Number(level)) + 1;
}

/**
 * Inserts one anonymous invitation (`source` member or qr) and copies the
 * inviter's inherited package into `invitation_modules`/`invitation_categories`.
 * Returns the new invitation id.
 */
export async function insertClubInvitation(
  db: QueryClient,
  input: {
    inviterId: string;
    source: "member" | "qr";
    depth: number;
    locale: EmailLocale;
    token: string;
    expiresAt: Date;
  },
): Promise<string> {
  const pkg = await inheritPackage(db, input.inviterId);
  const { rows } = await db.query(
    `insert into public.invitations
       (email, name, role, source, depth, token_hash, locale, expires_at, created_by)
     values (null, null, 'user', $1, $2, $3, $4, $5, $6)
     returning id`,
    [
      input.source,
      input.depth,
      hashInviteToken(input.token),
      input.locale,
      input.expiresAt.toISOString(),
      input.inviterId,
    ],
  );
  const id = String(rows[0]?.id);
  if (pkg.modules.length > 0) {
    await db.query(
      `insert into public.invitation_modules (invitation_id, module_key)
       select $1, unnest($2::text[])`,
      [id, pkg.modules],
    );
  }
  if (pkg.categories.length > 0) {
    await db.query(
      `insert into public.invitation_categories (invitation_id, user_category_id)
       select $1, unnest($2::uuid[])`,
      [id, pkg.categories],
    );
  }
  return id;
}

/**
 * Creates an anonymous member invitation (`POST /me/invitations`) whose link
 * lives for the configured `invitations.member_ttl_hours`. Session-only; role is
 * always `user`; the quota check and the insert share one transaction under
 * `pg_advisory_xact_lock('invite:' || uid)`.
 */
export async function createMemberInvitation(
  deps: InvitationsDeps,
  caller: Caller,
): Promise<{ invitation: InvitationView; token: string; path: string }> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;
  const now = deps.now?.() ?? new Date();
  const token = newInviteToken(INVITE_TOKEN_PREFIX);

  const { rows: profileRows } = await deps.db.query(
    "select invite_level, locale from public.profiles where id = $1",
    [uid],
  );
  const inviter = profileRows[0];
  if (!inviter) throw new DomainError("unauthorized");
  const depth = depthOf(inviter);
  const locale = inviterLocale(inviter);
  const expiresAt = new Date(now.getTime() + (await memberTtlMs(deps.db)));

  const invitationId = await withInviteTx(deps, async (db) => {
    await db.query("select pg_advisory_xact_lock(hashtext('invite:' || $1))", [uid]);
    const quota = await invitationQuota(db, uid);
    if (!quota.unlimited && quota.remaining <= 0) {
      throw new DomainError("invitation_quota_exhausted");
    }
    return insertClubInvitation(db, {
      inviterId: uid,
      source: "member",
      depth,
      locale,
      token,
      expiresAt,
    });
  });

  return {
    invitation: await getInvitation(deps, invitationId),
    token,
    path: `/invite/${token}`,
  };
}

/**
 * Re-issues the link of one of the caller's own pending invitations
 * (`POST /me/invitations/{id}/link`). The token is only stored hashed, so a
 * link that was lost cannot be shown again: the same invitation gets a fresh
 * token and the previous link stops working. `expires_at` is left alone —
 * showing it again is not a new invitation, so it never extends the deadline.
 */
export async function rotateOwnInvitationLink(
  deps: InvitationsDeps,
  caller: Caller,
  id: string,
): Promise<{ token: string; path: string }> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const token = newInviteToken(INVITE_TOKEN_PREFIX);
  const { rows } = await deps.db.query(
    `update public.invitations set token_hash = $1
      where id = $2 and created_by = $3
        and used_at is null and revoked_at is null and expires_at > now()
      returning id`,
    [hashInviteToken(token), id, caller.userId],
  );
  // A used, revoked, expired or foreign invitation is the same 404: the caller
  // cannot learn anything about invitations that are not theirs.
  if (!rows[0]) throw new DomainError("not_found");
  return { token, path: `/invite/${token}` };
}

/** Revokes one of the caller's own pending invitations; another user's is a 404. */
export async function revokeOwnInvitation(
  deps: InvitationsDeps,
  caller: Caller,
  id: string,
): Promise<void> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;

  const { rows } = await deps.db.query(
    `update public.invitations set revoked_at = now()
      where id = $1 and created_by = $2 and used_at is null and revoked_at is null
      returning id`,
    [id, uid],
  );
  if (rows[0]) return;

  const { rows: existing } = await deps.db.query(
    "select created_by, used_at, revoked_at from public.invitations where id = $1",
    [id],
  );
  const row = existing[0];
  if (!row) throw new DomainError("not_found");
  // Another user's invitation is indistinguishable from a missing one.
  if (String(row.created_by) !== uid) throw new DomainError("not_found");
  if (row.used_at !== null && row.used_at !== undefined) {
    throw new DomainError("invitation_used");
  }
  // Already revoked: revocation is idempotent.
}

/** One row of `GET /me/invitations`: a pending link without its token. */
export type OwnInvitationListItem = {
  id: string;
  state: InvitationStatus;
  source: InvitationSource;
  expires_at: string;
  path: null;
  redeemed_by: { id: string; display_name: string } | null;
  created_at: string;
};

/** A direct invitee of the caller (`invited_by = caller`). */
export type OwnInvitee = {
  id: string;
  display_name: string;
  level: number | null;
  state: "active" | "deactivated";
  joined_at: string;
};

/** The one pending request the app shows on the quota bar (spec §6.2). */
export type PendingInvitationRequest = {
  id: string;
  amount: number;
  created_at: string;
};

export type OwnInvitationsView = {
  quota: InvitationQuota & { pending_request: PendingInvitationRequest | null };
  invitations: OwnInvitationListItem[];
  invitees: OwnInvitee[];
  /** The caller's latest 10 requests, newest first (resolved or not). */
  requests: InvitationRequestView[];
};

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? "");

function invitationState(row: Record<string, unknown>, now: Date): InvitationStatus {
  if (row.used_at !== null && row.used_at !== undefined) return "used";
  if (row.revoked_at !== null && row.revoked_at !== undefined) return "revoked";
  return new Date(String(row.expires_at)).getTime() <= now.getTime() ? "expired" : "pending";
}

/**
 * The caller's live quota plus their own invitations (never the tokens), their
 * direct invitees and their recent quota requests. `pending_request` names the
 * one open request (there can only be one), so the app can show it on the bar.
 */
export async function listOwnInvitations(
  deps: InvitationsDeps,
  caller: Caller,
): Promise<OwnInvitationsView> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;
  const now = deps.now?.() ?? new Date();

  const quota = await invitationQuota(deps.db, uid);
  const requests = await listOwnInvitationRequests(deps, uid, 10);
  const pending = requests.find((request) => request.state === "pending") ?? null;
  const pendingRequest: PendingInvitationRequest | null = pending
    ? { id: pending.id, amount: pending.amount, created_at: pending.created_at }
    : null;

  const { rows: invitationRows } = await deps.db.query(
    `select i.id, i.source, i.expires_at, i.used_at, i.revoked_at, i.created_at,
            rb.id as redeemed_by_id, rb.display_name as redeemed_by_display_name
       from public.invitations i
       left join public.profiles rb on rb.id = i.redeemed_by
      where i.created_by = $1
      order by i.created_at desc, i.id desc`,
    [uid],
  );
  const { rows: inviteeRows } = await deps.db.query(
    `select id, display_name, invite_level, deactivated_at, created_at
       from public.profiles
      where invited_by = $1 and role = 'user'
      order by created_at asc, id asc`,
    [uid],
  );

  return {
    quota: { ...quota, pending_request: pendingRequest },
    invitations: invitationRows.map((row) => ({
      id: String(row.id),
      state: invitationState(row, now),
      source: (row.source === "member" || row.source === "qr" ? row.source : "admin") as InvitationSource,
      expires_at: toIso(row.expires_at),
      path: null,
      redeemed_by:
        row.redeemed_by_id === null || row.redeemed_by_id === undefined
          ? null
          : {
              id: String(row.redeemed_by_id),
              display_name:
                row.redeemed_by_display_name === null ||
                row.redeemed_by_display_name === undefined
                  ? ""
                  : String(row.redeemed_by_display_name),
            },
      created_at: toIso(row.created_at),
    })),
    invitees: inviteeRows.map((row) => ({
      id: String(row.id),
      display_name: String(row.display_name),
      level:
        row.invite_level === null || row.invite_level === undefined
          ? null
          : Number(row.invite_level),
      state:
        row.deactivated_at === null || row.deactivated_at === undefined
          ? "active"
          : "deactivated",
      joined_at: toIso(row.created_at),
    })),
    requests,
  };
}
