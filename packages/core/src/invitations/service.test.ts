import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import { redeemInvitation, type InvitationsAuth, type InvitationsDeps } from "./service.js";

const INVITATION = {
  id: "i1",
  email: "ana@example.com",
  name: "Ana",
  user_category_id: null,
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
}): { db: QueryClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (sql.includes("from public.invitations") && sql.includes("token_hash")) {
        return { rows: [INVITATION] };
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
