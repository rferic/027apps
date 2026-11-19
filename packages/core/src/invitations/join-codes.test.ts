import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "../api/types.js";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { InvitationsDeps } from "./service.js";

const { invitationQuotaMock } = vi.hoisted(() => ({ invitationQuotaMock: vi.fn() }));

vi.mock("./quota.js", () => ({
  invitationQuota: invitationQuotaMock,
  parseInvitationLevels: () => [],
  baseQuotaFor: () => 0,
}));

import {
  createJoinCode,
  exchangeJoinCode,
  previewJoinCode,
} from "./join-codes.js";

const SESSION: Caller = { kind: "session", userId: "u-1", role: "user" };
const NOW = new Date("2026-11-19T12:00:00.000Z");

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

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

const ACTIVE_PROFILE = () => [{ invite_level: 1, locale: "es", deactivated_at: null }];
const PENDING_CODE = () => [
  { id: "code-1", inviter_id: "u-1", expires_at: "2026-11-19T12:01:00.000Z", used_at: null },
];

beforeEach(() => {
  invitationQuotaMock.mockReset();
  invitationQuotaMock.mockResolvedValue({
    level: 1,
    base: 5,
    granted: 0,
    used: 0,
    reserved: 0,
    remaining: 5,
    unlimited: false,
  });
});

describe("createJoinCode", () => {
  it("mints a 90s one-use code", async () => {
    const { db, queries } = fakeDb({
      "select deactivated_at from public.profiles": () => [
        { deactivated_at: null },
      ],
      "insert into public.join_codes": () => [{ id: "code-1" }],
    });

    const result = await createJoinCode(deps(db), SESSION);

    expect(result.code).toMatch(/^027_join_/);
    expect(result.id).toBe("code-1");
    expect(result.path).toBe(`/join/${result.code}`);
    expect(result.expires_at).toBe(
      new Date(NOW.getTime() + 90_000).toISOString(),
    );

    const insert = queries.find((q) => q.sql.includes("insert into public.join_codes"));
    expect(insert?.params).toEqual([
      "u-1",
      expect.stringMatching(/^[0-9a-f]{64}$/),
      new Date(NOW.getTime() + 90_000).toISOString(),
    ]);
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
      "select deactivated_at from public.profiles": () => [
        { deactivated_at: null },
      ],
    });

    await expect(createJoinCode(deps(db), SESSION)).rejects.toMatchObject({
      code: "invitation_quota_exhausted",
    });
    expect(queries.some((q) => q.sql.includes("insert into public.join_codes"))).toBe(false);
  });
});

describe("exchangeJoinCode", () => {
  it("exchanges a code for a 15min invitation once", async () => {
    const { db, queries } = fakeDb({
      "from public.join_codes where code_hash": PENDING_CODE,
      "select invite_level, locale, deactivated_at from public.profiles": ACTIVE_PROFILE,
      "insert into public.invitations": () => [{ id: "inv-1" }],
      "update public.join_codes set used_at": () => [],
    });

    const result = await exchangeJoinCode(deps(db), "027_join_abc123");

    expect(result.token).toMatch(/^027_inv_/);
    expect(result.path).toBe(`/invite/${result.token}`);

    const invitationInsert = queries.find((q) => q.sql.includes("insert into public.invitations"));
    // source = 'qr', depth = 2, expires_at = now + 15 min.
    expect(invitationInsert?.params?.[0]).toBe("qr");
    expect(invitationInsert?.params?.[1]).toBe(2);
    expect(invitationInsert?.params?.[4]).toBe(
      new Date(NOW.getTime() + 15 * 60 * 1000).toISOString(),
    );

    const used = queries.find((q) => q.sql.includes("update public.join_codes set used_at"));
    expect(used?.params).toEqual(["inv-1", "code-1"]);
  });

  it("a second exchange is join_code_used and never replays the token", async () => {
    const { db, queries } = fakeDb({
      "from public.join_codes where code_hash": () => [
        { id: "code-1", inviter_id: "u-1", expires_at: "2026-11-19T12:01:00.000Z", used_at: "2026-11-19T12:00:30.000Z" },
      ],
    });

    await expect(exchangeJoinCode(deps(db), "027_join_abc123")).rejects.toMatchObject({
      code: "join_code_used",
    });
    expect(queries.some((q) => q.sql.includes("insert into public.invitations"))).toBe(false);
  });

  it("an expired or unknown code is not_found", async () => {
    const expired = fakeDb({
      "from public.join_codes where code_hash": () => [
        { id: "code-1", inviter_id: "u-1", expires_at: "2026-11-19T11:00:00.000Z", used_at: null },
      ],
    });
    await expect(exchangeJoinCode(deps(expired.db), "027_join_abc123")).rejects.toMatchObject({
      code: "not_found",
    });

    const unknown = fakeDb({});
    await expect(exchangeJoinCode(deps(unknown.db), "027_join_abc123")).rejects.toMatchObject({
      code: "not_found",
    });

    const malformed = fakeDb({});
    await expect(exchangeJoinCode(deps(malformed.db), "nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("an inactive inviter cannot exchange", async () => {
    const { db } = fakeDb({
      "from public.join_codes where code_hash": PENDING_CODE,
      "select invite_level, locale, deactivated_at from public.profiles": () => [
        { invite_level: 1, locale: "es", deactivated_at: "2026-11-19T00:00:00.000Z" },
      ],
    });

    await expect(exchangeJoinCode(deps(db), "027_join_abc123")).rejects.toMatchObject({
      code: "invitation_inviter_inactive",
    });
  });
});

describe("previewJoinCode", () => {
  it("returns the inviter and instance names without mutating", async () => {
    const { db, queries } = fakeDb({
      "from public.join_codes jc": () => [
        { expires_at: "2026-11-19T12:01:00.000Z", used_at: null, inviter_name: "Eric" },
      ],
      "from public.settings where key = 'instance.name'": () => [
        { value: "Familia Pérez" },
      ],
    });

    const preview = await previewJoinCode(deps(db), "027_join_abc123");

    expect(preview).toEqual({
      state: "pending",
      inviter_name: "Eric",
      instance_name: "Familia Pérez",
    });
    expect(queries.some((q) => q.sql.includes("insert into"))).toBe(false);
  });
});
