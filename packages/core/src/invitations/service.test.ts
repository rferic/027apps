import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { Caller } from "../api/types.js";
import {
  createInvitation,
  getInvitation,
  redeemInvitation,
  resendCooldownSeconds,
  rotateInvitationToken,
  RESEND_COOLDOWN_MS,
  type InvitationView,
  type InvitationsAuth,
  type InvitationsDeps,
} from "./service.js";

const INVITATION = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: null,
  locale: null,
  expires_at: "2099-01-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by: null,
  created_by_key: "key-1",
};

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

/**
 * Minimal in-memory port: enough of the redemption flow to observe the
 * profile INSERT. Settings rows and invitation rows are injected per test.
 */
function fakeDb(input: {
  settings: { key: string; value: unknown }[];
  profile?: { display_name: string } | null;
  invitation?: { locale: string | null };
}): { db: QueryClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (sql.includes("from public.invitations") && sql.includes("token_hash")) {
        return { rows: [{ ...INVITATION, ...(input.invitation ?? {}) }] };
      }
      if (sql.includes("select deactivated_at from public.profiles")) {
        return { rows: [] };
      }
      if (sql.includes("from public.settings where key = any")) {
        return { rows: input.settings };
      }
      if (sql.includes("insert into public.profiles")) {
        return { rows: [] };
      }
      if (sql.includes("insert into public.user_modules")) {
        return { rows: [] };
      }
      if (sql.includes("update public.invitations set used_at")) {
        return { rows: [] };
      }
      if (sql.includes("insert into public.event_outbox")) {
        return { rows: [] };
      }
      if (sql.includes("select display_name from public.profiles")) {
        return { rows: [{ display_name: input.profile?.display_name ?? "Ana" }] };
      }
      return { rows: [] };
    },
  };
  return { db, queries };
}

function auth(): InvitationsAuth {
  return {
    async findUserByEmail() {
      return null;
    },
    async createUser() {
      return { id: "u1", created: true };
    },
    async deleteUser() {
      // The successful paths never call this.
    },
  };
}

function profileInsert(queries: RecordedQuery[]): RecordedQuery | undefined {
  return queries.find((entry) => entry.sql.includes("insert into public.profiles"));
}

describe("redeemInvitation localization", () => {
  it("seeds the new profile with the instance locale and time zone", async () => {
    const fake = fakeDb({
      settings: [
        { key: "localization.default_locale", value: "es" },
        { key: "localization.timezone", value: "Europe/Madrid" },
      ],
    });
    const deps: InvitationsDeps = { db: fake.db, auth: auth() };

    await redeemInvitation(deps, "027_inv_valid", {
      email: "ana@example.com",
      password: "correct-horse-battery",
    });

    const insert = profileInsert(fake.queries);
    expect(insert?.sql).toContain("locale");
    expect(insert?.sql).toContain("timezone");
    expect(insert?.params).toEqual(["u1", "Ana", "es", "Europe/Madrid"]);
  });

  it("falls back to en/UTC when the settings are missing or null", async () => {
    const fake = fakeDb({
      settings: [
        { key: "localization.default_locale", value: null },
        { key: "localization.timezone", value: null },
      ],
    });
    const deps: InvitationsDeps = { db: fake.db, auth: auth() };

    await redeemInvitation(deps, "027_inv_valid", {
      email: "ana@example.com",
      password: "correct-horse-battery",
    });

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "en", "UTC"]);
  });

  it("falls back per key when only one of the two settings is usable", async () => {
    const fake = fakeDb({
      settings: [{ key: "localization.default_locale", value: "gl" }],
    });
    const deps: InvitationsDeps = { db: fake.db, auth: auth() };

    await redeemInvitation(deps, "027_inv_valid", {
      email: "ana@example.com",
      password: "correct-horse-battery",
    });

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "gl", "UTC"]);
  });

  it("prefers the invitation's locale over the instance default", async () => {
    const fake = fakeDb({
      settings: [
        { key: "localization.default_locale", value: "es" },
        { key: "localization.timezone", value: "Europe/Madrid" },
      ],
      invitation: { locale: "ca" },
    });
    const deps: InvitationsDeps = { db: fake.db, auth: auth() };

    await redeemInvitation(deps, "027_inv_valid", {
      email: "ana@example.com",
      password: "correct-horse-battery",
    });

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "ca", "Europe/Madrid"]);
  });

  it("ignores an unsupported invitation locale and keeps the default", async () => {
    const fake = fakeDb({
      settings: [{ key: "localization.default_locale", value: "gl" }],
      invitation: { locale: "xx" },
    });
    const deps: InvitationsDeps = { db: fake.db, auth: auth() };

    await redeemInvitation(deps, "027_inv_valid", {
      email: "ana@example.com",
      password: "correct-horse-battery",
    });

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "gl", "UTC"]);
  });

  it("keeps a deactivated account check before the localization read", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.invitations") && sql.includes("token_hash")) {
        return { rows: [INVITATION] };
      }
      if (sql.includes("select deactivated_at from public.profiles")) {
        return { rows: [{ deactivated_at: "2026-01-01T00:00:00.000Z" }] };
      }
      return { rows: [] };
    });
    const deps: InvitationsDeps = { db: { query }, auth: auth() };

    await expect(
      redeemInvitation(deps, "027_inv_valid", {
        email: "ana@example.com",
        password: "correct-horse-battery",
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    expect(query.mock.calls.some(([sql]) => String(sql).includes("from public.settings"))).toBe(false);
  });
});

const ADMIN: Caller = { kind: "session", userId: "admin-1", role: "admin" };
const NOW = new Date("2026-11-08T12:00:00.000Z");

interface StoredInvitation {
  id: string;
  email: string;
  name: string;
  user_category_id: string | null;
  locale?: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  email_sent_at?: string | null;
  email_failed_at?: string | null;
  email_error?: string | null;
  created_at: string;
}

const stored = (overrides: Partial<StoredInvitation> = {}): StoredInvitation => ({
  id: `i-${Math.random().toString(36).slice(2)}`,
  email: "ana@example.com",
  name: "Ana",
  user_category_id: null,
  expires_at: "2099-01-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-11-01T00:00:00.000Z",
  ...overrides,
});

/**
 * In-memory `public.invitations`. `withTransaction` hands every call its own
 * client (like a pooled connection) and `pg_advisory_xact_lock` serialises the
 * same email until the transaction ends, which is what the concurrent test needs
 * to exercise the real ordering instead of the fake's bookkeeping.
 */
function invitationTable(seed: StoredInvitation[] = []) {
  const rows: StoredInvitation[] = [...seed];
  const chains = new Map<string, Promise<void>>();
  let seq = 0;

  function acquire(key: string): Promise<() => void> {
    const previous = chains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    chains.set(
      key,
      previous.then(() => current),
    );
    return previous.then(() => release);
  }

  function makeClient(held: (() => void)[]): QueryClient {
    return {
      async query(sql, params = []) {
        if (sql.includes("pg_advisory_xact_lock")) {
          held.push(await acquire(String(params[0])));
          return { rows: [] };
        }
        if (sql.includes("from public.invitations") && sql.includes("expires_at >")) {
          const [email, now] = params as [string, string];
          const pending = rows.some(
            (row) =>
              row.email === email &&
              row.used_at === null &&
              row.revoked_at === null &&
              new Date(row.expires_at).getTime() > new Date(now).getTime(),
          );
          return { rows: pending ? [{ pending: 1 }] : [] };
        }
        if (sql.includes("insert into public.invitations")) {
          seq += 1;
          const [email, name, categoryId, , locale, expiresAt] = params as [
            string,
            string,
            string | null,
            string,
            string,
            string,
          ];
          const id = `i-new-${seq}`;
          rows.push({
            id,
            email,
            name,
            user_category_id: categoryId,
            locale,
            expires_at: expiresAt,
            used_at: null,
            revoked_at: null,
            email_sent_at: null,
            email_failed_at: null,
            email_error: null,
            created_at: NOW.toISOString(),
          });
          return { rows: [{ id }] };
        }
        if (sql.includes("from public.invitations where id = $1")) {
          const found = rows.find((row) => row.id === params[0]);
          return { rows: found ? [{ ...found }] : [] };
        }
        return { rows: [] };
      },
    };
  }

  return {
    rows,
    db: makeClient([]),
    async withTransaction<T>(fn: (db: QueryClient) => Promise<T>): Promise<T> {
      const held: (() => void)[] = [];
      try {
        return await fn(makeClient(held));
      } finally {
        for (const release of held) release();
      }
    },
  };
}

function createDeps(
  table: ReturnType<typeof invitationTable>,
  existingUserId: string | null = null,
): InvitationsDeps {
  return {
    db: table.db,
    withTransaction: table.withTransaction,
    now: () => NOW,
    auth: {
      async findUserByEmail() {
        return existingUserId ? { id: existingUserId } : null;
      },
      async createUser() {
        return { id: "u1", created: true };
      },
      async deleteUser() {},
    },
  };
}

describe("createInvitation rules", () => {
  it("rejects a second pending invitation for the same email", async () => {
    const table = invitationTable([stored({ email: "ana@example.com" })]);
    const deps = createDeps(table);

    await expect(
      createInvitation(deps, ADMIN, { email: "ana@example.com", name: "Ana again" }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "That email already has a pending invitation",
      details: { code: "pending_invitation" },
    });
    expect(table.rows).toHaveLength(1);
  });

  it("rejects an email that already belongs to a member", async () => {
    const table = invitationTable();
    const deps = createDeps(table, "user-1");

    await expect(
      createInvitation(deps, ADMIN, { email: "ana@example.com", name: "Ana" }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "That email already belongs to a member",
      details: { code: "email_registered" },
    });
    expect(table.rows).toHaveLength(0);
  });

  it("allows the email of a used or an expired invitation", async () => {
    const table = invitationTable([
      stored({ email: "ana@example.com", used_at: "2026-11-02T00:00:00.000Z" }),
      stored({ email: "luis@example.com", expires_at: "2026-11-01T00:00:00.000Z" }),
    ]);
    const deps = createDeps(table);

    await expect(
      createInvitation(deps, ADMIN, { email: "ana@example.com", name: "Ana" }),
    ).resolves.toMatchObject({ invitation: { email: "ana@example.com", status: "pending" } });
    await expect(
      createInvitation(deps, ADMIN, { email: "luis@example.com", name: "Luis" }),
    ).resolves.toMatchObject({ invitation: { email: "luis@example.com", status: "pending" } });
    expect(table.rows).toHaveLength(4);
  });

  it("normalises the email before storing and comparing it", async () => {
    const table = invitationTable();
    const deps = createDeps(table);

    const created = await createInvitation(deps, ADMIN, {
      email: "  Ana@Example.COM ",
      name: "Ana",
    });

    expect(created.invitation.email).toBe("ana@example.com");
    expect(table.rows[0]?.email).toBe("ana@example.com");

    await expect(
      createInvitation(deps, ADMIN, { email: " ANA@example.com", name: "Ana 2" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(table.rows).toHaveLength(1);
  });

  it("leaves a single invitation when two creates race", async () => {
    const table = invitationTable();
    const deps = createDeps(table);

    const attempts = await Promise.allSettled([
      createInvitation(deps, ADMIN, { email: "ana@example.com", name: "One" }),
      createInvitation(deps, ADMIN, { email: "ana@example.com", name: "Two" }),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    expect(rejected?.reason).toMatchObject({ code: "conflict", details: { code: "pending_invitation" } });
    expect(table.rows).toHaveLength(1);
  });
});

function detailDeps(input: {
  row?: Record<string, unknown> | null;
  modules?: string[];
  now?: Date;
}): InvitationsDeps {
  const row = input.row === undefined ? null : input.row;
  const db = {
    async query(sql: string) {
      if (sql.includes("from public.invitations i")) return { rows: row ? [row] : [] };
      if (sql.includes("from public.invitation_modules")) {
        return { rows: (input.modules ?? []).map((key) => ({ invitation_id: "i1", module_key: key })) };
      }
      return { rows: [] };
    },
  };
  return { db, auth: auth(), now: () => input.now ?? new Date("2026-01-01T00:00:00.000Z") };
}

const DETAIL_ROW = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: null,
  expires_at: "2099-01-01T00:00:00.000Z",
  used_at: null,
  revoked_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  created_by_id: null,
  created_by_display_name: null,
};

describe("getInvitation", () => {
  it("resolves the creator when a session created the invitation", async () => {
    const detail = await getInvitation(
      detailDeps({
        row: {
          ...DETAIL_ROW,
          created_by_id: "u-1",
          created_by_display_name: "Sara",
        },
        modules: ["balances", "expenses"],
      }),
      "i1",
    );

    expect(detail.created_by).toEqual({ id: "u-1", display_name: "Sara" });
    expect(detail.modules).toEqual(["balances", "expenses"]);
    expect(detail.status).toBe("pending");
  });

  it("returns created_by null when the invitation was created by a key", async () => {
    const detail = await getInvitation(detailDeps({ row: DETAIL_ROW }), "i1");

    expect(detail.created_by).toBeNull();
  });

  it("answers not_found when the invitation does not exist", async () => {
    await expect(getInvitation(detailDeps({ row: null }), "i1")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("never exposes the token or its hash", async () => {
    const detail = await getInvitation(detailDeps({ row: DETAIL_ROW }), "i1");
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain("token");
    expect(detail).not.toHaveProperty("token");
    expect(detail).not.toHaveProperty("token_hash");
  });
});


describe("rotateInvitationToken", () => {
  const NOW = new Date("2026-01-01T00:00:00.000Z");
  const pending = {
    id: "i1",
    email: "ana@example.com",
    name: "Ana",
    user_category_id: null,
    locale: "es",
    expires_at: "2099-01-01T00:00:00.000Z",
    used_at: null,
    revoked_at: null,
    email_sent_at: null,
    email_failed_at: null,
    email_error: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  function depsFor(row: Record<string, unknown> | null, now = NOW) {
    const updates: unknown[][] = [];
    const deps: InvitationsDeps = {
      db: {
        async query(sql, params = []) {
          if (sql.includes("for update")) return { rows: row ? [row] : [] };
          if (sql.includes("set token_hash")) {
            updates.push(params);
            return { rows: [] };
          }
          if (sql.includes("invitation_modules")) return { rows: [] };
          return { rows: [] };
        },
      },
      auth: auth(),
      now: () => now,
    };
    return { deps, updates };
  }

  it("issues a new token and replaces the stored hash", async () => {
    const { deps, updates } = depsFor(pending);

    const rotated = await rotateInvitationToken(deps, "i1");

    expect(rotated.token).toMatch(/^027_inv_/);
    expect(rotated.token).not.toBe(pending.id);
    expect(rotated.invitation.locale).toBe("es");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.[1]).toBe("i1");
    expect(String(updates[0]?.[0])).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a redeemed invitation", async () => {
    const { deps } = depsFor({ ...pending, used_at: "2026-01-01T00:00:00.000Z" });

    await expect(rotateInvitationToken(deps, "i1")).rejects.toMatchObject({
      code: "invitation_used",
    });
  });

  it("refuses an expired invitation", async () => {
    const { deps } = depsFor({ ...pending, expires_at: "2025-01-01T00:00:00.000Z" });

    await expect(rotateInvitationToken(deps, "i1")).rejects.toMatchObject({
      code: "invitation_expired",
    });
  });

  it("hides a revoked invitation behind not_found", async () => {
    const { deps } = depsFor({ ...pending, revoked_at: "2026-01-01T00:00:00.000Z" });

    await expect(rotateInvitationToken(deps, "i1")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("resendCooldownSeconds", () => {
  const view = {
    email_sent_at: "2026-01-01T00:00:00.000Z",
    email_failed_at: null,
  } as unknown as InvitationView;

  it("counts the remaining seconds of the window", () => {
    const now = new Date(new Date(view.email_sent_at!).getTime() + 15_000);
    expect(resendCooldownSeconds(view, now)).toBe(45);
  });

  it("is zero once the window has passed", () => {
    const now = new Date(new Date(view.email_sent_at!).getTime() + RESEND_COOLDOWN_MS + 1);
    expect(resendCooldownSeconds(view, now)).toBe(0);
  });

  it("is zero when there was no attempt", () => {
    expect(
      resendCooldownSeconds({ email_sent_at: null, email_failed_at: null } as InvitationView, new Date()),
    ).toBe(0);
  });
});
