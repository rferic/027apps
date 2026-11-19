import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import { isEmailLocale, type EmailLocale } from "../email/types";
import { invitationQuota } from "./quota";
import { hashInviteToken, newInviteToken, withInviteTx } from "./shared";
import { insertClubInvitation } from "./member";
import type { InvitationsDeps } from "./service";

/**
 * Rotating QR codes (sprint 18 spec §5.4/§6.3/§7.1): a 90-second single-use
 * code a member shows in person. Exchanging it mints a 15-minute anonymous
 * invitation under the inviter's quota; the code's token is stored only as
 * SHA-256 and can never be replayed.
 */

export const JOIN_CODE_TTL_MS = 90_000;
export const QR_INVITATION_TTL_MS = 15 * 60 * 1000;
const JOIN_TOKEN_PREFIX = "027_join_";
const INVITE_TOKEN_PREFIX = "027_inv_";
const MAX_CODE_LENGTH = 200;

/** The instance display name, without a session (same fallback as the preview). */
async function instanceName(db: InvitationsDeps["db"]): Promise<string> {
  const { rows } = await db.query("select value from public.settings where key = 'instance.name'");
  const value = rows[0]?.value;
  return typeof value === "string" && value.length > 0 ? value : "027Apps";
}

/** The inviter's locale, falling back to English when unset or invalid. */
function inviterLocale(row: Record<string, unknown>): EmailLocale {
  return isEmailLocale(row.locale) ? row.locale : "en";
}

/** Depth the invitee will get: the inviter's level plus one (admin root → 1). */
function depthOf(row: Record<string, unknown>): number {
  const level = row.invite_level;
  return (level === null || level === undefined ? 0 : Number(level)) + 1;
}

/**
 * Mints a 90-second join code (`POST /me/join-codes`). Session-only. Minting
 * checks the quota but reserves nothing: a code that is never scanned costs no
 * seat. Old codes of the inviter are cleaned up opportunistically.
 */
export async function createJoinCode(
  deps: InvitationsDeps,
  caller: Caller,
): Promise<{ id: string; code: string; expires_at: string; path: string }> {
  if (caller.kind !== "session") throw new DomainError("unauthorized");
  const uid = caller.userId;
  const now = deps.now?.() ?? new Date();
  const token = newInviteToken(JOIN_TOKEN_PREFIX);
  const expiresAt = new Date(now.getTime() + JOIN_CODE_TTL_MS);

  const { rows: activeRows } = await deps.db.query(
    "select deactivated_at from public.profiles where id = $1",
    [uid],
  );
  const profile = activeRows[0];
  if (!profile || (profile.deactivated_at !== null && profile.deactivated_at !== undefined)) {
    throw new DomainError("invitation_inviter_inactive");
  }

  const quota = await invitationQuota(deps.db, uid);
  if (!quota.unlimited && quota.remaining <= 0) {
    throw new DomainError("invitation_quota_exhausted");
  }

  const id = await withInviteTx(deps, async (db) => {
    await db.query(
      `delete from public.join_codes
        where inviter_id = $1
          and (used_at is not null or expires_at < now() - interval '1 day')`,
      [uid],
    );
    const { rows } = await db.query(
      `insert into public.join_codes (inviter_id, code_hash, expires_at)
       values ($1, $2, $3)
       returning id`,
      [uid, hashInviteToken(token), expiresAt.toISOString()],
    );
    return String(rows[0]?.id);
  });

  return {
    id,
    code: token,
    expires_at: expiresAt.toISOString(),
    path: `/join/${token}`,
  };
}

/** Public preview of a join code: state plus the inviter and instance names. */
export type JoinCodePreview = {
  state: "pending" | "expired" | "used";
  inviter_name: string | null;
  instance_name: string;
};

export async function previewJoinCode(
  deps: InvitationsDeps,
  rawCode: string,
): Promise<JoinCodePreview> {
  if (!rawCode.startsWith(JOIN_TOKEN_PREFIX) || rawCode.length > MAX_CODE_LENGTH) {
    throw new DomainError("not_found");
  }
  const now = deps.now?.() ?? new Date();
  const { rows } = await deps.db.query(
    `select jc.expires_at, jc.used_at, p.display_name as inviter_name
       from public.join_codes jc
       left join public.profiles p on p.id = jc.inviter_id
      where jc.code_hash = $1`,
    [hashInviteToken(rawCode)],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  const state =
    row.used_at !== null && row.used_at !== undefined
      ? "used"
      : new Date(String(row.expires_at)).getTime() <= now.getTime()
        ? "expired"
        : "pending";
  return {
    state,
    inviter_name:
      row.inviter_name === null || row.inviter_name === undefined
        ? null
        : String(row.inviter_name),
    instance_name: await instanceName(deps.db),
  };
}

/**
 * Public exchange (`POST /join-codes/{code}/exchange`). Single-use: the code
 * row is locked, its TTL and the inviter's active state are checked, a
 * 15-minute invitation is minted under the advisory lock and the code is marked
 * used. A second exchange answers `join_code_used`; the token is returned once.
 */
export async function exchangeJoinCode(
  deps: InvitationsDeps,
  rawCode: string,
): Promise<{ token: string; path: string }> {
  if (!rawCode.startsWith(JOIN_TOKEN_PREFIX) || rawCode.length > MAX_CODE_LENGTH) {
    throw new DomainError("not_found");
  }
  const codeHash = hashInviteToken(rawCode);
  const now = deps.now?.() ?? new Date();
  const token = newInviteToken(INVITE_TOKEN_PREFIX);

  await withInviteTx(deps, async (db) => {
    const { rows } = await db.query(
      `select id, inviter_id, expires_at, used_at
         from public.join_codes where code_hash = $1 for update`,
      [codeHash],
    );
    const codeRow = rows[0];
    if (!codeRow) throw new DomainError("not_found");
    if (codeRow.used_at !== null && codeRow.used_at !== undefined) {
      throw new DomainError("join_code_used");
    }
    if (new Date(String(codeRow.expires_at)).getTime() <= now.getTime()) {
      throw new DomainError("not_found");
    }

    const inviterId = String(codeRow.inviter_id);
    const { rows: profileRows } = await db.query(
      "select invite_level, locale, deactivated_at from public.profiles where id = $1",
      [inviterId],
    );
    const inviter = profileRows[0];
    if (!inviter || (inviter.deactivated_at !== null && inviter.deactivated_at !== undefined)) {
      throw new DomainError("invitation_inviter_inactive");
    }

    await db.query("select pg_advisory_xact_lock(hashtext('invite:' || $1))", [inviterId]);
    const quota = await invitationQuota(db, inviterId);
    if (!quota.unlimited && quota.remaining <= 0) {
      throw new DomainError("invitation_quota_exhausted");
    }

    const invitationId = await insertClubInvitation(db, {
      inviterId,
      source: "qr",
      depth: depthOf(inviter),
      locale: inviterLocale(inviter),
      token,
      expiresAt: new Date(now.getTime() + QR_INVITATION_TTL_MS),
    });

    await db.query(
      "update public.join_codes set used_at = now(), invitation_id = $1 where id = $2 and used_at is null",
      [invitationId, String(codeRow.id)],
    );
  });

  return { token, path: `/invite/${token}` };
}
