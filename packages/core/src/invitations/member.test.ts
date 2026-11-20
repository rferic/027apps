import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "../api/types.js";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { InvitationsDeps, InvitationView } from "./service.js";

const { invitationQuotaMock, getInvitationMock } = vi.hoisted(() => ({
  invitationQuotaMock: vi.fn(),
  getInvitationMock: vi.fn(),
}));

vi.mock("./quota.js", () => ({
  invitationQuota: invitationQuotaMock,
  parseInvitationLevels: () => [],
  baseQuotaFor: () => 0,
}));

vi.mock("./service.js", async (importActual) => ({
  ...(await importActual<typeof import("./service.js")>()),
  getInvitation: getInvitationMock,
}));

import {
  createMemberInvitation,
  inheritPackage,
  revokeOwnInvitation,
} from "./member.js";

const SESSION: Caller = { kind: "session", userId: "u-1", role: "user" };
const NOW = new Date("2026-11-19T12:00:00.000Z");

const CANNED_VIEW: InvitationView = {
  id: "inv-1",
  email: null,
  name: null,
  role: "user",
  source: "member",
  depth: 2,
  anonymous: true,
  expires_in_days: null,
  user_category_id: null,
  modules: ["balances"],
  status: "pending",
  locale: "es",
  expires_at: "2026-11-21T12:00:00.000Z",
  used_at: null,
  revoked_at: null,
  mode: "not_sent",
  email_sent_at: null,
  email_failed_at: null,
  email_error: null,
  created_by: { id: "u-1", display_name: "Eric" },
  redeemed_by: null,
  created_at: "2026-11-19T12:00:00.000Z",
};

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

/** Records every query and answers by matching the SQL against a handler map. */
function fakeDb(handlers: Record<string, (params: unknown[]) => unknown[]>): {
  db: QueryClient;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      for (const [needle, respond] of Object.entries(handlers)) {
        if (sql.includes(needle)) {
          return { rows: respond(params) as Record<string, unknown>[] };
        }
      }
      return { rows: [] };
    },
  };
  return { db, queries };
}

function deps(db: QueryClient): InvitationsDeps {
  return {
    db,
    auth: {
      async findUserByEmail() {
        return null;
      },
      async createUser() {
        return { id: "u-new", created: true };
      },
      async deleteUser() {},
    },
    now: () => NOW,
  };
}

const invitationsInsert = (q: RecordedQuery[]) =>
  q.find((entry) => entry.sql.includes("insert into public.invitations"));

beforeEach(() => {
  invitationQuotaMock.mockReset();
  getInvitationMock.mockReset();
  invitationQuotaMock.mockResolvedValue({
    level: 1,
    base: 5,
    granted: 0,
    used: 0,
    reserved: 0,
    remaining: 5,
    unlimited: false,
  });
  getInvitationMock.mockResolvedValue(CANNED_VIEW);
});

describe("inheritPackage", () => {
  it("inherits public modules, delegable private modules and every category", async () => {
    const { db, queries } = fakeDb({
      "select um.module_key": () => [
        { module_key: "balances" },
        { module_key: "expenses" },
      ],
      "select user_category_id": () => [
        { user_category_id: "cat-1" },
        { user_category_id: "cat-2" },
      ],
    });

    const pkg = await inheritPackage(db, "u-1");

    expect(pkg.modules).toEqual(["balances", "expenses"]);
    expect(pkg.categories).toEqual(["cat-1", "cat-2"]);

    // A private, non-delegable module must not leak through: the filter lives in
    // the SQL the service runs (the real predicate is exercised by db-tests).
    const modulesSql = queries.find((q) => q.sql.includes("select um.module_key"))?.sql ?? "";
    expect(modulesSql).toContain("mr.is_public or mr.delegable");
    expect(modulesSql).toContain("um.revoked_at is null");
  });
});

describe("createMemberInvitation", () => {
  it("creates an anonymous 48h invitation with role user and depth level+1", async () => {
    const { db, queries } = fakeDb({
      "select invite_level, locale from public.profiles": () => [
        { invite_level: 1, locale: "es" },
      ],
      "insert into public.invitations": () => [{ id: "inv-1" }],
    });

    const result = await createMemberInvitation(deps(db), SESSION);

    expect(result.token).toMatch(/^027_inv_/);
    expect(result.path).toBe(`/invite/${result.token}`);
    expect(result.invitation).toEqual(CANNED_VIEW);

    const insert = invitationsInsert(queries);
    expect(insert).toBeDefined();
    // values (null, null, 'user', $1, $2, $3, $4, $5, $6)
    //  $1 = source, $2 = depth, $3 = token hash, $4 = locale, $5 = expires_at, $6 = created_by
    expect(insert!.params).toEqual([
      "member",
      2,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      "es",
      new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      "u-1",
    ]);
    expect(invitationQuotaMock).toHaveBeenCalled();
  });

  it("uses the lifetime configured in the panel", async () => {
    const { db, queries } = fakeDb({
      "select invite_level, locale from public.profiles": () => [
        { invite_level: 1, locale: "es" },
      ],
      "select value from public.settings": () => [{ value: 6 }],
      "insert into public.invitations": () => [{ id: "inv-1" }],
    });

    await createMemberInvitation(deps(db), SESSION);

    expect(invitationsInsert(queries)!.params[4]).toBe(
      new Date(NOW.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("reads a jsonb number, a numeric string or the default", async () => {
    const expiresWith = async (value: unknown): Promise<unknown> => {
      const { db, queries } = fakeDb({
        "select invite_level, locale from public.profiles": () => [
          { invite_level: 1, locale: "es" },
        ],
        "select value from public.settings": () => [{ value }],
        "insert into public.invitations": () => [{ id: "inv-1" }],
      });
      await createMemberInvitation(deps(db), SESSION);
      return invitationsInsert(queries)!.params[4];
    };
    const after = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();

    expect(await expiresWith("12")).toBe(after(12));
    // Missing, unusable or out of range always means the 48-hour default.
    expect(await expiresWith(null)).toBe(after(48));
    expect(await expiresWith(0)).toBe(after(48));
    expect(await expiresWith(721)).toBe(after(48));
    expect(await expiresWith("soon")).toBe(after(48));
  });

  it("refuses when the inviter has no seats left", async () => {
    invitationQuotaMock.mockResolvedValue({
      level: 1,
      base: 1,
      granted: 0,
      used: 1,
      reserved: 0,
      remaining: 0,
      unlimited: false,
    });
    const { db, queries } = fakeDb({
      "select invite_level, locale from public.profiles": () => [
        { invite_level: 1, locale: "es" },
      ],
    });

    await expect(createMemberInvitation(deps(db), SESSION)).rejects.toMatchObject({
      code: "invitation_quota_exhausted",
    });
    expect(invitationsInsert(queries)).toBeUndefined();
  });

  it("rejects a non-session caller", async () => {
    const { db } = fakeDb({});
    await expect(
      createMemberInvitation(deps(db), { kind: "anon" }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});

describe("revokeOwnInvitation", () => {
  it("revokes only the caller's own pending invitation", async () => {
    const { db, queries } = fakeDb({
      "update public.invitations set revoked_at": () => [{ id: "inv-1" }],
    });

    await revokeOwnInvitation(deps(db), SESSION, "inv-1");

    const update = queries.find((q) => q.sql.includes("update public.invitations set revoked_at"));
    expect(update?.params).toEqual(["inv-1", "u-1"]);
  });

  it("hides another user's invitation behind not_found", async () => {
    const { db } = fakeDb({
      "update public.invitations set revoked_at": () => [],
      "select created_by, used_at, revoked_at": () => [{ created_by: "someone-else" }],
    });

    await expect(revokeOwnInvitation(deps(db), SESSION, "inv-1")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
