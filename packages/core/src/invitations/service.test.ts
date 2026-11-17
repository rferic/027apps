import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { Caller } from "../api/types.js";
import {
  createInvitation,
  getInvitation,
  previewInvitation,
  redeemInvitation,
  renewInvitation,
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
  profile?: { display_name: string; role?: string } | null;
  invitation?: { locale?: string | null; role?: string };
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
      if (sql.includes("select display_name")) {
        return {
          rows: [
            {
              display_name: input.profile?.display_name ?? "Ana",
              role: input.profile?.role ?? input.invitation?.role ?? "user",
            },
          ],
        };
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
    expect(insert?.params).toEqual(["u1", "Ana", "user", "es", "Europe/Madrid"]);
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

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "user", "en", "UTC"]);
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

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "user", "gl", "UTC"]);
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

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "user", "ca", "Europe/Madrid"]);
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

    expect(profileInsert(fake.queries)?.params).toEqual(["u1", "Ana", "user", "gl", "UTC"]);
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
  role: string;
  expires_in_days: number;
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
  role: "user",
  expires_in_days: 7,
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
          const [email, name, role, categoryId, , locale, days, expiresAt] = params as [
            string,
            string,
            string,
            string | null,
            string,
            string,
            number,
            string,
          ];
          const id = `i-new-${seq}`;
          rows.push({
            id,
            email,
            name,
            role,
            expires_in_days: days,
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

  it("allows an email that already belongs to a member and reports it", async () => {
    const table = invitationTable();
    const deps = createDeps(table, "user-1");

    const created = await createInvitation(deps, ADMIN, {
      email: "ana@example.com",
      name: "Ana",
    });

    expect(created.account_exists).toBe(true);
    expect(created.invitation).toMatchObject({
      email: "ana@example.com",
      role: "user",
      expires_in_days: 7,
      status: "pending",
    });
    expect(table.rows).toHaveLength(1);
  });

  it("reports account_exists false for a new address", async () => {
    const table = invitationTable();
    const created = await createInvitation(createDeps(table), ADMIN, {
      email: "new@example.com",
      name: "Nueva",
    });

    expect(created.account_exists).toBe(false);
  });

  it("rejects admin invitations from an admin session", async () => {
    const table = invitationTable();

    await expect(
      createInvitation(createDeps(table), ADMIN, {
        email: "ana@example.com",
        name: "Ana",
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
    expect(table.rows).toHaveLength(0);
  });

  it("allows admin invitations from a super_admin session", async () => {
    const table = invitationTable();
    const superAdmin: Caller = { kind: "session", userId: "root", role: "super_admin" };

    const created = await createInvitation(createDeps(table), superAdmin, {
      email: "ana@example.com",
      name: "Ana",
      role: "admin",
      expires_in_days: 30,
    });

    expect(created.invitation.role).toBe("admin");
    expect(created.invitation.expires_in_days).toBe(30);
  });

  it("allows admin invitations from a service key capped at super_admin", async () => {
    const table = invitationTable();
    const service: Caller = {
      kind: "service",
      keyId: "key-1",
      scopes: ["invitations:write"],
      roleCap: "super_admin",
    };

    const created = await createInvitation(createDeps(table), service, {
      email: "ana@example.com",
      name: "Ana",
      role: "admin",
    });

    expect(created.invitation.role).toBe("admin");
  });

  it("never lets a delegated key invite an admin", async () => {
    const table = invitationTable();
    const delegated: Caller = {
      kind: "delegated",
      keyId: "key-1",
      scopes: ["invitations:write"],
      roleCap: "super_admin",
      userId: "u-1",
    };

    await expect(
      createInvitation(createDeps(table), delegated, {
        email: "ana@example.com",
        name: "Ana",
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
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

const PREVIEW_ROW = {
  email: "ana@example.com",
  name: "Ana",
  role: "user",
  locale: "es",
  expires_at: "2026-11-24T12:00:00.000Z",
  used_at: null,
  revoked_at: null,
  inviter_name: "Eric",
};

function previewDeps(input: {
  row?: Record<string, unknown> | null;
  existing?: { id: string } | null;
  settings?: { key: string; value: unknown }[];
}): InvitationsDeps {
  const db = {
    async query(sql: string) {
      if (sql.includes("from public.invitations i")) return { rows: input.row ? [input.row] : [] };
      if (sql.includes("from public.settings")) return { rows: input.settings ?? [] };
      return { rows: [] };
    },
  };
  return {
    db,
    now: () => new Date("2026-11-17T12:00:00.000Z"),
    auth: {
      async findUserByEmail() {
        return input.existing ?? null;
      },
      async createUser() {
        throw new Error("preview must not create users");
      },
      async deleteUser() {
        throw new Error("preview must not delete users");
      },
    },
  };
}

describe("previewInvitation", () => {
  it("returns the public contract for a pending invitation", async () => {
    const preview = await previewInvitation(
      previewDeps({
        row: PREVIEW_ROW,
        settings: [
          { key: "instance.name", value: "Familia Pérez" },
          { key: "localization.timezone", value: "Europe/Madrid" },
        ],
      }),
      "027_inv_valid",
    );

    expect(preview).toEqual({
      state: "pending",
      email: "ana@example.com",
      name: "Ana",
      role: "user",
      role_applies: true,
      account_exists: false,
      locale: "es",
      expires_at: "2026-11-24T12:00:00.000Z",
      inviter_name: "Eric",
      instance_name: "Familia Pérez",
      timezone: "Europe/Madrid",
    });
  });

  it("marks an existing account and says the role does not apply", async () => {
    const preview = await previewInvitation(
      previewDeps({
        row: { ...PREVIEW_ROW, role: "admin" },
        existing: { id: "u1" },
      }),
      "027_inv_valid",
    );

    expect(preview.account_exists).toBe(true);
    expect(preview.role_applies).toBe(false);
    expect(preview.role).toBe("admin");
  });

  it("explains a used invitation", async () => {
    const preview = await previewInvitation(
      previewDeps({ row: { ...PREVIEW_ROW, used_at: "2026-11-18T00:00:00.000Z" } }),
      "027_inv_valid",
    );
    expect(preview.state).toBe("used");
  });

  it("explains an expired invitation", async () => {
    const preview = await previewInvitation(
      previewDeps({ row: { ...PREVIEW_ROW, expires_at: "2026-11-01T00:00:00.000Z" } }),
      "027_inv_valid",
    );
    expect(preview.state).toBe("expired");
  });

  it("hides a revoked invitation behind not_found", async () => {
    await expect(
      previewInvitation(
        previewDeps({ row: { ...PREVIEW_ROW, revoked_at: "2026-11-18T00:00:00.000Z" } }),
        "027_inv_valid",
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects an unknown or malformed token with the same not_found", async () => {
    await expect(
      previewInvitation(previewDeps({ row: null }), "027_inv_unknown"),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(previewInvitation(previewDeps({ row: PREVIEW_ROW }), "nope")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("keeps the inviter null for a key-created invitation and the instance defaults", async () => {
    const preview = await previewInvitation(
      previewDeps({
        row: { ...PREVIEW_ROW, inviter_name: null, locale: null },
      }),
      "027_inv_valid",
    );

    expect(preview.inviter_name).toBeNull();
    expect(preview.instance_name).toBe("027Apps");
    expect(preview.timezone).toBe("UTC");
    expect(preview.locale).toBe("en");
  });
});

function renewDeps(row: Record<string, unknown>) {
  const updates: unknown[][] = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("for update")) return { rows: [row] };
      if (sql.includes("update public.invitations")) {
        updates.push(params);
        return { rows: [] };
      }
      if (sql.includes("from public.invitation_modules")) return { rows: [] };
      return { rows: [] };
    },
  };
  const deps: InvitationsDeps = {
    db,
    now: () => NOW,
    auth: auth(),
  };
  return { deps, updates };
}

describe("renewInvitation", () => {
  const expired = {
    ...stored({ expires_at: "2026-11-01T00:00:00.000Z" }),
    expires_in_days: 30,
    email_sent_at: "2026-10-01T00:00:00.000Z",
    email_failed_at: null,
    email_error: null,
  };

  it("rotates the token and reuses the original duration", async () => {
    const { deps, updates } = renewDeps(expired);

    const renewed = await renewInvitation(deps, "i1");

    expect(renewed.token).toMatch(/^027_inv_/);
    expect(renewed.invitation.expires_in_days).toBe(30);
    // NOW is 2026-11-08; 30 days later is 2026-12-08.
    expect(renewed.invitation.expires_at).toBe("2026-12-08T12:00:00.000Z");
    expect(renewed.invitation.mode).toBe("not_sent");
    expect(updates).toHaveLength(1);
    expect(String(updates[0]?.[0])).toMatch(/^[0-9a-f]{64}$/);
    expect(updates[0]?.[2]).toBe("i1");
  });

  it("refuses an invitation that has not expired", async () => {
    const { deps } = renewDeps({ ...expired, expires_at: "2099-01-01T00:00:00.000Z" });
    await expect(renewInvitation(deps, "i1")).rejects.toMatchObject({
      code: "invitation_not_expired",
    });
  });

  it("refuses a redeemed invitation", async () => {
    const { deps } = renewDeps({ ...expired, used_at: "2026-11-02T00:00:00.000Z" });
    await expect(renewInvitation(deps, "i1")).rejects.toMatchObject({ code: "invitation_used" });
  });

  it("hides a revoked invitation", async () => {
    const { deps } = renewDeps({ ...expired, revoked_at: "2026-11-02T00:00:00.000Z" });
    await expect(renewInvitation(deps, "i1")).rejects.toMatchObject({ code: "not_found" });
  });
});

function existingAccountDeps(input: {
  existingId: string;
  profileRole?: string;
  invitationRole?: string;
}): { deps: InvitationsDeps; queries: RecordedQuery[] } {
  const fake = fakeDb({
    settings: [],
    profile: { display_name: "Nombre guardado", role: input.profileRole ?? "admin" },
    invitation: { locale: "es", role: input.invitationRole ?? "user" },
  });
  return {
    queries: fake.queries,
    deps: {
      db: fake.db,
      now: () => new Date("2026-11-17T12:00:00.000Z"),
      auth: {
        async findUserByEmail() {
          return { id: input.existingId };
        },
        async createUser() {
          throw new Error("an existing account must not be created again");
        },
        async deleteUser() {
          throw new Error("an existing account must not be deleted");
        },
      },
    },
  };
}

describe("redeemInvitation for an existing account", () => {
  it("requires the session of that same account", async () => {
    const { deps, queries } = existingAccountDeps({ existingId: "u-existing" });

    await expect(
      redeemInvitation(deps, "027_inv_valid", { email: "ana@example.com" }),
    ).rejects.toMatchObject({ code: "existing_account_signin_required" });

    await expect(
      redeemInvitation(
        deps,
        "027_inv_valid",
        { email: "ana@example.com" },
        { kind: "session", userId: "someone-else", role: "admin" },
      ),
    ).rejects.toMatchObject({ code: "existing_account_signin_required" });

    // Neither attempt touched the invitation.
    expect(queries.some((entry) => entry.sql.includes("update public.invitations"))).toBe(false);
  });

  it("accepts with the session of the invited account and keeps its name and role", async () => {
    const { deps, queries } = existingAccountDeps({ existingId: "u-existing" });

    const result = await redeemInvitation(
      deps,
      "027_inv_valid",
      { email: "ana@example.com" },
      { kind: "session", userId: "u-existing", role: "user" },
    );

    expect(result.user).toMatchObject({
      id: "u-existing",
      display_name: "Nombre guardado",
      role: "admin",
    });
    const insert = profileInsert(queries);
    // `on conflict do nothing`: a new row would still take the invitation role.
    expect(insert?.params).toEqual(["u-existing", "Ana", "user", "es", "UTC"]);
    expect(queries.some((entry) => entry.sql.includes("update public.invitations set used_at"))).toBe(
      true,
    );
  });

  it("ignores the obsolete display_name and uses the invitation name", async () => {
    const fake = fakeDb({ settings: [] });
    const result = await redeemInvitation(
      { db: fake.db, auth: auth() },
      "027_inv_valid",
      {
        email: "ana@example.com",
        password: "correct-horse-battery",
        display_name: "Otro nombre",
      },
    );

    expect(profileInsert(fake.queries)?.params?.[1]).toBe("Ana");
    expect(result.user.display_name).toBe("Ana");
  });

  it("needs a password to create a new account", async () => {
    const fake = fakeDb({ settings: [] });

    await expect(
      redeemInvitation({ db: fake.db, auth: auth() }, "027_inv_valid", {
        email: "ana@example.com",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(profileInsert(fake.queries)).toBeUndefined();
  });

  it("creates a new profile with the invitation role", async () => {
    const fake = fakeDb({ settings: [], invitation: { locale: "es", role: "admin" } });

    const result = await redeemInvitation(
      { db: fake.db, auth: auth() },
      "027_inv_valid",
      { email: "ana@example.com", password: "correct-horse-battery" },
    );

    expect(profileInsert(fake.queries)?.params?.[2]).toBe("admin");
    expect(result.user.role).toBe("admin");
  });
});
