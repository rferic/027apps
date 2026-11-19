import type { QueryClient } from "../api/rate-limit-storage";
import { invitationLevelsSchema } from "../settings/catalog";

/**
 * Live invitation quota (sprint 18 spec §5.9).
 *
 * The count is never stored: one read derives it from the profile's level, the
 * instance's level table, the grants it received and the invitations it minted.
 * A stored counter would drift the moment a grant is revoked, an invitation
 * expires or an invitee is purged.
 */
export type InvitationLevel = { level: number; quota: number };

export type InvitationQuota = {
  /** `profiles.invite_level`; null for an administrator or a profile without one. */
  level: number | null;
  /** Seats the level grants, 0 when the level is missing from the table. */
  base: number;
  /** Sum of the profile's live grants. */
  granted: number;
  /** Seats taken by direct invitees that are still member profiles. */
  used: number;
  /** Seats held by the profile's pending member/QR invitations. */
  reserved: number;
  /** Never negative: spending past the top leaves it at 0 and blocks new ones. */
  remaining: number;
  /** Administrators invite without a quota. */
  unlimited: boolean;
};

/** One row of the single quota read. */
const QUOTA_SQL = `
  select p.role,
         p.invite_level,
         (select s.value from public.settings s where s.key = 'invitations.levels') as levels,
         (select coalesce(sum(g.amount), 0)::int
            from public.invitation_quota_grants g
           where g.user_id = p.id and g.revoked_at is null) as granted,
         (select count(*)::int
            from public.profiles i
           where i.invited_by = p.id and i.role = 'user') as used,
         (select count(*)::int
            from public.invitations v
           where v.created_by = p.id
             and v.source in ('member', 'qr')
             and v.used_at is null
             and v.revoked_at is null
             and v.expires_at > now()) as reserved
    from public.profiles p
   where p.id = $1
`;

/**
 * The stored `invitations.levels` value, or `[]` when it does not validate.
 * `settings.value` is jsonb, but a text representation is tolerated: a broken
 * setting means "no member can invite" instead of a failed read.
 */
export function parseInvitationLevels(value: unknown): InvitationLevel[] {
  let entries: unknown = value;
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch {
      return [];
    }
  }
  const parsed = invitationLevelsSchema.safeParse(entries);
  return parsed.success ? parsed.data.map(({ level, quota }) => ({ level, quota })) : [];
}

/** Base seats of a level; a missing level (or no level) invites nobody. */
export function baseQuotaFor(levels: InvitationLevel[], level: number | null): number {
  if (level === null) return 0;
  return levels.find((entry) => entry.level === level)?.quota ?? 0;
}

/** Counts arrive as numbers from `pg`; anything unusable reads as 0. */
function count(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Live quota of one profile. A read never throws a domain error: a profile that
 * no longer exists answers a zeroed quota, so a caller racing a purge gets a
 * "no seats" answer instead of a 404.
 */
export async function invitationQuota(
  db: QueryClient,
  userId: string,
): Promise<InvitationQuota> {
  const { rows } = await db.query(QUOTA_SQL, [userId]);
  const row = rows[0];
  if (!row) {
    return {
      level: null,
      base: 0,
      granted: 0,
      used: 0,
      reserved: 0,
      remaining: 0,
      unlimited: false,
    };
  }

  const level = row.invite_level === null || row.invite_level === undefined
    ? null
    : Number(row.invite_level);
  const base = baseQuotaFor(parseInvitationLevels(row.levels), level);
  const granted = count(row.granted);
  const used = count(row.used);
  const reserved = count(row.reserved);
  return {
    level,
    base,
    granted,
    used,
    reserved,
    remaining: Math.max(0, base + granted - used - reserved),
    unlimited: row.role === "admin" || row.role === "super_admin",
  };
}
