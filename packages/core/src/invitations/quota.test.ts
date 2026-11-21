import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import {
  baseQuotaFor,
  invitationQuota,
  parseInvitationLevels,
  type InvitationLevel,
} from "./quota.js";

const LEVELS: InvitationLevel[] = [
  { level: 1, quota: 5 },
  { level: 2, quota: 2 },
  { level: 3, quota: 1 },
];

const NOW = new Date("2026-11-19T12:00:00.000Z");
const USER = "00000000-0000-4000-8000-000000000001";

type GrantRow = { amount: number; revoked_at?: string | null };
type InviteeRow = { role: "super_admin" | "admin" | "user" };
type InvitationRow = {
  source: "admin" | "member" | "qr";
  used_at?: string | null;
  revoked_at?: string | null;
  expires_at: string;
};

/**
 * A fake QueryClient for the single quota read. A case is written as the rows
 * of the three sources, and the fake mirrors the predicates the production SQL
 * carries; the SQL itself is exercised by `packages/db-tests`.
 */
function quotaDb(caseRows: {
  missing?: boolean;
  role?: "super_admin" | "admin" | "user";
  level?: number | null;
  levels?: unknown;
  grants?: GrantRow[];
  invitees?: InviteeRow[];
  invitations?: InvitationRow[];
}): { db: QueryClient; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async (_sql: string, _params: unknown[] = []) => {
    if (caseRows.missing) return { rows: [] };

    const granted = (caseRows.grants ?? [])
      .filter((grant) => grant.revoked_at === null || grant.revoked_at === undefined)
      .reduce((sum, grant) => sum + grant.amount, 0);
    const used = (caseRows.invitees ?? []).filter((row) => row.role === "user").length;
    const reserved = (caseRows.invitations ?? []).filter(
      (row) =>
        (row.source === "member" || row.source === "qr") &&
        (row.used_at === null || row.used_at === undefined) &&
        (row.revoked_at === null || row.revoked_at === undefined) &&
        new Date(row.expires_at).getTime() > NOW.getTime(),
    ).length;

    return {
      rows: [
        {
          role: caseRows.role ?? "user",
          invite_level: caseRows.level ?? null,
          levels: "levels" in caseRows ? caseRows.levels : LEVELS,
          granted,
          used,
          reserved,
        },
      ],
    };
  });
  return { db: { query: query as QueryClient["query"] }, query };
}

describe("parseInvitationLevels", () => {
  it("parses contiguous levels and ignores an invalid setting", () => {
    expect(parseInvitationLevels(LEVELS)).toEqual(LEVELS);
    // `settings.value` is jsonb; a text representation is tolerated as well.
    expect(parseInvitationLevels(JSON.stringify(LEVELS))).toEqual(LEVELS);

    // A gap, an unsorted list, a bad type and junk JSON are all "no levels".
    expect(
      parseInvitationLevels([
        { level: 1, quota: 5 },
        { level: 3, quota: 1 },
      ]),
    ).toEqual([]);
    expect(parseInvitationLevels([{ level: 2, quota: 1 }])).toEqual([]);
    expect(parseInvitationLevels([{ level: 1, quota: 5, extra: true }])).toEqual([]);
    expect(parseInvitationLevels("not json")).toEqual([]);
    expect(parseInvitationLevels(null)).toEqual([]);
    expect(parseInvitationLevels({ level: 1, quota: 5 })).toEqual([]);
  });
});

describe("baseQuotaFor", () => {
  it("returns 0 for a level missing from the list", () => {
    expect(baseQuotaFor(LEVELS, 2)).toBe(2);
    expect(baseQuotaFor(LEVELS, 4)).toBe(0);
    expect(baseQuotaFor(LEVELS, null)).toBe(0);
    expect(baseQuotaFor([], 1)).toBe(0);
  });
});

describe("invitationQuota", () => {
  it("adds active grants and keeps revoked ones out", async () => {
    const { db } = quotaDb({
      level: 2,
      grants: [{ amount: 3 }, { amount: 5, revoked_at: "2026-11-01T00:00:00.000Z" }],
    });

    const quota = await invitationQuota(db, USER);

    expect(quota).toMatchObject({ level: 2, base: 2, granted: 3, used: 0, reserved: 0 });
    expect(quota.remaining).toBe(5);
    expect(quota.unlimited).toBe(false);
  });

  it("counts only role=user profiles and pending valid invitations", async () => {
    const { db } = quotaDb({
      level: 1,
      invitees: [{ role: "user" }, { role: "user" }, { role: "admin" }],
      invitations: [
        { source: "member", expires_at: "2026-11-20T12:00:00.000Z" },
        { source: "qr", expires_at: "2026-11-20T12:00:00.000Z" },
        // An admin mint is not a member reservation.
        { source: "admin", expires_at: "2026-11-20T12:00:00.000Z" },
        // Expired, revoked and used rows reserve nothing.
        { source: "member", expires_at: "2026-11-19T00:00:00.000Z" },
        { source: "member", revoked_at: "2026-11-18T00:00:00.000Z", expires_at: "2026-11-20T12:00:00.000Z" },
        { source: "member", used_at: "2026-11-18T00:00:00.000Z", expires_at: "2026-11-20T12:00:00.000Z" },
      ],
    });

    const quota = await invitationQuota(db, USER);

    expect(quota).toMatchObject({ base: 5, granted: 0, used: 2, reserved: 2 });
    expect(quota.remaining).toBe(1);
  });

  it("never reports a negative remainder", async () => {
    const { db } = quotaDb({
      level: 3,
      grants: [{ amount: 1 }],
      invitees: [{ role: "user" }, { role: "user" }, { role: "user" }],
      invitations: [{ source: "member", expires_at: "2026-11-20T12:00:00.000Z" }],
    });

    const quota = await invitationQuota(db, USER);

    expect(quota).toMatchObject({ base: 1, granted: 1, used: 3, reserved: 1 });
    expect(quota.remaining).toBe(0);
  });

  it("returns unlimited for an admin", async () => {
    for (const role of ["admin", "super_admin"] as const) {
      const { db } = quotaDb({ role, level: null });

      const quota = await invitationQuota(db, USER);

      expect(quota.unlimited).toBe(true);
      expect(quota.base).toBe(0);
    }
  });

  it("returns a zeroed quota when the profile is gone", async () => {
    const { db } = quotaDb({ missing: true });

    const quota = await invitationQuota(db, USER);

    expect(quota).toEqual({
      level: null,
      base: 0,
      granted: 0,
      used: 0,
      reserved: 0,
      remaining: 0,
      unlimited: false,
    });
  });
});
