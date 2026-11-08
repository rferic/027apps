import { beforeEach, describe, expect, it } from "vitest";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { DELEGATED_SCOPES } from "../auth/guard";
import {
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
  type ApiKeysDeps,
  type ApiKeyKind,
  type ApiKeyRoleCap,
} from "./service";

const NOW = new Date("2026-11-08T12:00:00.000Z");
const PAGE = { limit: 100, offset: 0 };

type Role = "super_admin" | "admin" | "user";

interface Profile {
  id: string;
  role: Role;
  deactivated: boolean;
}

interface StoredKey {
  id: string;
  key_hash: string;
  kind: ApiKeyKind;
  name: string;
  scopes: string[];
  user_id: string | null;
  role_cap: ApiKeyRoleCap | null;
  created_by: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

/**
 * In-memory Postgres for the api-keys service. `withTransaction` hands every
 * call its own client (like a pooled connection) and `pg_advisory_xact_lock`
 * serialises the same owner until the transaction ends, so the concurrent test
 * exercises the real ordering instead of the fake's bookkeeping.
 */
function apiKeyTable(profiles: Profile[] = []) {
  const rows: StoredKey[] = [];
  const grants = new Map<string, Set<string>>();
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

  function active(row: StoredKey): boolean {
    if (row.revoked_at !== null) return false;
    return row.expires_at === null || new Date(row.expires_at).getTime() > NOW.getTime();
  }

  const view = (row: StoredKey) => ({ ...row, scopes: [...row.scopes] });

  function makeClient(held: (() => void)[]): QueryClient {
    return {
      async query(sql: string, params: unknown[] = []) {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] };
        }
        if (sql.includes("pg_advisory_xact_lock")) {
          held.push(await acquire(String(params[0])));
          return { rows: [] };
        }
        if (sql.includes("from public.profiles")) {
          const profile = profiles.find(
            (entry) => entry.id === params[0] && !entry.deactivated,
          );
          return { rows: profile ? [{ role: profile.role }] : [] };
        }
        if (sql.includes("from public.user_modules")) {
          const [userId, keys] = params as [string, string[]];
          const granted = grants.get(userId) ?? new Set<string>();
          return {
            rows: keys
              .filter((key) => granted.has(key))
              .map((key) => ({ module_key: key })),
          };
        }
        if (sql.includes("count(*)::int as n") && sql.includes("kind = 'delegated'")) {
          const owner = String(params[0]);
          const excluded = sql.includes("id <> $2") ? String(params[1]) : null;
          const count = rows.filter(
            (row) =>
              row.kind === "delegated" &&
              row.user_id === owner &&
              row.id !== excluded &&
              active(row),
          ).length;
          return { rows: [{ n: count }] };
        }
        if (sql.startsWith("insert into public.api_keys")) {
          seq += 1;
          const [keyHash, kind, name, scopes, userId, roleCap, actor, expiresAt] = params as [
            string,
            ApiKeyKind,
            string,
            string[],
            string | null,
            ApiKeyRoleCap | null,
            string,
            string | null,
          ];
          const row: StoredKey = {
            id: `k-${seq}`,
            key_hash: keyHash,
            kind,
            name,
            scopes,
            user_id: userId,
            role_cap: roleCap,
            created_by: actor,
            expires_at: expiresAt,
            revoked_at: null,
            last_used_at: null,
            created_at: NOW.toISOString(),
          };
          rows.push(row);
          return { rows: [view(row)] };
        }
        if (sql.includes("with total")) {
          const [limit, offset] = params.slice(-2) as [number, number];
          // Filters are positional; read each one from the placeholder it uses
          // so the fake follows the real query instead of a fixed param order.
          const kindMatch = sql.match(/kind = \$(\d+)/);
          const userMatch = sql.match(/user_id = \$(\d+)/);
          const kind = kindMatch ? String(params[Number(kindMatch[1]) - 1]) : null;
          const userId = userMatch ? String(params[Number(userMatch[1]) - 1]) : null;
          const state = sql.includes("expires_at is null or expires_at > now()")
            ? "active"
            : sql.includes("expires_at <= now()")
              ? "expired"
              : sql.includes("revoked_at is not null")
                ? "revoked"
                : null;
          const visible = rows.filter((row) => {
            if (kind && row.kind !== kind) return false;
            if (userId && row.user_id !== userId) return false;
            if (state === "revoked") return row.revoked_at !== null;
            if (state === "active") return active(row);
            if (state === "expired") {
              return row.revoked_at === null && !active(row);
            }
            return true;
          });
          const page = visible.slice(offset, offset + limit);
          const total = visible.length;
          if (page.length === 0) return { rows: [{ total }] };
          return { rows: page.map((row) => ({ ...view(row), total })) };
        }
        if (sql.includes("from public.api_keys where id = $1")) {
          const row = rows.find((entry) => entry.id === params[0]);
          return { rows: row ? [view(row)] : [] };
        }
        if (sql.startsWith("update public.api_keys set") && sql.includes("returning")) {
          const row = rows.find(
            (entry) => entry.id === params[params.length - 1] && entry.revoked_at === null,
          );
          if (!row) return { rows: [] };
          for (const match of sql.matchAll(/(\w+) = \$(\d+)/g)) {
            const field = match[1] as keyof StoredKey;
            (row as unknown as Record<string, unknown>)[field] = params[Number(match[2]) - 1];
          }
          // `expires_at = null` carries no placeholder.
          if (/\bexpires_at = null\b/.test(sql)) row.expires_at = null;
          return { rows: [view(row)] };
        }
        if (sql.startsWith("update public.api_keys")) {
          const row = rows.find((entry) => entry.id === params[0]);
          if (row && row.revoked_at === null) row.revoked_at = NOW.toISOString();
          return { rows: [] };
        }
        return { rows: [] };
      },
    };
  }

  const db: QueryClient = makeClient([]);

  return {
    rows,
    grants,
    db,
    deps: {
      db,
      now: () => NOW,
      withTransaction: async <T>(fn: (client: QueryClient) => Promise<T>) => {
        const held: (() => void)[] = [];
        try {
          return await fn(makeClient(held));
        } finally {
          for (const release of held) release();
        }
      },
    } satisfies ApiKeysDeps,
    seed(overrides: Partial<StoredKey> = {}): StoredKey {
      seq += 1;
      const row: StoredKey = {
        id: `seed-${seq}`,
        key_hash: `hash-${seq}`,
        kind: "delegated",
        name: "Seed",
        scopes: ["profile:read"],
        user_id: null,
        role_cap: null,
        created_by: "u1",
        expires_at: null,
        revoked_at: null,
        last_used_at: null,
        created_at: NOW.toISOString(),
        ...overrides,
      };
      rows.push(row);
      return row;
    },
  };
}

let table: ReturnType<typeof apiKeyTable>;

const profile = (id: string, role: Role = "user", deactivated = false): Profile => ({
  id,
  role,
  deactivated,
});

const session = (userId: string, role: Role): Caller => ({ kind: "session", userId, role });
const delegated = (
  userId: string,
  scopes: string[],
  roleCap: "user" | "admin" | "super_admin" = "user",
): Caller => ({ kind: "delegated", keyId: "caller-key", scopes, roleCap, userId });
const service = (scopes: string[], roleCap: ApiKeyRoleCap): Caller => ({
  kind: "service",
  keyId: "svc",
  scopes,
  roleCap,
});

beforeEach(() => {
  table = apiKeyTable([
    profile("root", "super_admin"),
    profile("admin", "admin"),
    profile("user", "user"),
    profile("other", "user"),
    profile("off", "user", true),
  ]);
});

describe("createApiKey — delegated allowlist", () => {
  it("trims administration scopes from a delegated key instead of rejecting it", async () => {
    const { api_key } = await createApiKey(table.deps, session("admin", "admin"), {
      kind: "delegated",
      name: "Tool",
      scopes: ["users:read", "settings:write", "users:write", "currencies:write"],
    });

    expect(api_key.scopes).toEqual(["users:read"]);
    expect(table.rows[0]!.scopes).toEqual(["users:read"]);
    expect(DELEGATED_SCOPES).toContain("users:read");
  });

  it("fails with validation_failed when nothing survives the allowlist", async () => {
    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Tool",
        scopes: ["settings:write", "users:deactivate"],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(table.rows).toHaveLength(0);
  });

  it("keeps module scopes only when the owner holds the grant", async () => {
    table.grants.set("user", new Set(["expenses"]));

    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Tool",
      scopes: ["expenses:read", "invoices:read", "profile:read"],
    });

    expect(api_key.scopes).toEqual(["expenses:read", "profile:read"]);
  });

  it("refuses role_cap on a delegated key", async () => {
    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Tool",
        scopes: ["profile:read"],
        role_cap: "admin",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("never lets a delegated caller mint a wider delegated key than itself", async () => {
    const caller = delegated("user", ["profile:read", "api_keys:write"]);

    const { api_key } = await createApiKey(table.deps, caller, {
      kind: "delegated",
      name: "Narrow",
      scopes: ["profile:read", "devices:read"],
    });
    expect(api_key.scopes).toEqual(["profile:read"]);

    await expect(
      createApiKey(table.deps, caller, {
        kind: "delegated",
        name: "Escalation",
        scopes: ["devices:read"],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("does not let a delegated super_admin escalate into a service key", async () => {
    const caller = delegated("root", ["api_keys:write"], "super_admin");

    await expect(
      createApiKey(table.deps, caller, {
        kind: "service",
        name: "Escalation",
        scopes: ["users:deactivate"],
        role_cap: "super_admin",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});

describe("createApiKey — ownership", () => {
  it("attributes a delegated key to the actor by default", async () => {
    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Mine",
      scopes: ["profile:read"],
    });

    expect(api_key.user_id).toBe("user");
  });

  it("lets a super_admin session create a delegated key for another user", async () => {
    const { api_key } = await createApiKey(table.deps, session("root", "super_admin"), {
      kind: "delegated",
      name: "For other",
      scopes: ["profile:read"],
      user_id: "other",
    });

    expect(api_key.user_id).toBe("other");
    expect(api_key.role_cap).toBeNull();
  });

  it("rejects user_id from any caller that is not a super_admin session", async () => {
    for (const caller of [
      session("user", "user"),
      session("admin", "admin"),
      delegated("root", ["api_keys:write"], "super_admin"),
    ]) {
      await expect(
        createApiKey(table.deps, caller, {
          kind: "delegated",
          name: "Other owner",
          scopes: ["profile:read"],
          user_id: "other",
        }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    }
    expect(table.rows).toHaveLength(0);
  });

  it("treats an unknown or deactivated owner as not_found", async () => {
    for (const owner of ["missing", "off"]) {
      await expect(
        createApiKey(table.deps, session("root", "super_admin"), {
          kind: "delegated",
          name: "Owner",
          scopes: ["profile:read"],
          user_id: owner,
        }),
      ).rejects.toMatchObject({ code: "not_found" });
    }
  });

  it("rejects user_id on a service key", async () => {
    await expect(
      createApiKey(table.deps, session("root", "super_admin"), {
        kind: "service",
        name: "Service",
        scopes: ["users:read"],
        user_id: "other",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("createApiKey — service allowlist", () => {
  it("rejects personal and device scopes on a service key", async () => {
    await expect(
      createApiKey(table.deps, session("root", "super_admin"), {
        kind: "service",
        name: "Service",
        scopes: ["profile:read", "users:read"],
        role_cap: "admin",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("keeps maintenance:run and users:deactivate on the super_admin cap only", async () => {
    await expect(
      createApiKey(table.deps, session("root", "super_admin"), {
        kind: "service",
        name: "Admin cap",
        scopes: ["maintenance:run"],
        role_cap: "admin",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    const { api_key } = await createApiKey(table.deps, session("root", "super_admin"), {
      kind: "service",
      name: "Super cap",
      scopes: ["maintenance:run", "users:deactivate"],
      role_cap: "super_admin",
    });
    expect(api_key.role_cap).toBe("super_admin");
  });
});

describe("createApiKey — five active delegated keys per owner", () => {
  async function fill(owner = "user"): Promise<void> {
    for (let index = 0; index < 5; index += 1) {
      await createApiKey(table.deps, session(owner, "user"), {
        kind: "delegated",
        name: `Key ${index}`,
        scopes: ["profile:read"],
      });
    }
  }

  it("rejects the sixth active key with conflict and details.code key_limit", async () => {
    await fill();

    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Sixth",
        scopes: ["profile:read"],
      }),
    ).rejects.toMatchObject({ code: "conflict", details: { code: "key_limit" } });
  });

  it("counts per owner and ignores revoked or expired keys", async () => {
    await fill();
    table.seed({ user_id: "user", kind: "delegated", revoked_at: NOW.toISOString() });
    table.seed({
      user_id: "user",
      kind: "delegated",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });

    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Sixth",
        scopes: ["profile:read"],
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    const { api_key } = await createApiKey(table.deps, session("other", "user"), {
      kind: "delegated",
      name: "Other owner",
      scopes: ["profile:read"],
    });
    expect(api_key.user_id).toBe("other");
  });

  it("freeing a slot by revoking lets a new key in", async () => {
    await fill();
    const first = table.rows[0]!;
    await revokeApiKey(table.deps, session("user", "user"), first.id);

    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Replacement",
        scopes: ["profile:read"],
      }),
    ).resolves.toMatchObject({ api_key: { user_id: "user" } });
  });

  it("does not count service keys towards the owner limit", async () => {
    await fill();
    await createApiKey(table.deps, session("root", "super_admin"), {
      kind: "service",
      name: "Service",
      scopes: ["users:read"],
      role_cap: "admin",
    });

    await expect(
      createApiKey(table.deps, session("user", "user"), {
        kind: "delegated",
        name: "Sixth",
        scopes: ["profile:read"],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("serialises concurrent creations so exactly five succeed", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        createApiKey(table.deps, session("user", "user"), {
          kind: "delegated",
          name: `Concurrent ${index}`,
          scopes: ["profile:read"],
        }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: "conflict" });
  });
});

describe("api key list filters", () => {
  it("filters by kind and reports the filtered total", async () => {
    table.seed({ kind: "service", name: "Instance" });
    table.seed({ kind: "delegated", user_id: "user", name: "Mine" });
    table.seed({ kind: "delegated", user_id: "other", name: "Theirs" });

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      kind: "delegated",
    });

    expect(listed.api_keys.map((row) => row.name).sort()).toEqual(["Mine", "Theirs"]);
    expect(listed.total).toBe(2);
  });

  it("filters by owner and combines it with the kind", async () => {
    table.seed({ kind: "service", name: "Instance" });
    table.seed({ kind: "delegated", user_id: "user", name: "Mine" });
    table.seed({ kind: "delegated", user_id: "other", name: "Theirs" });

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      kind: "delegated",
      user: "other",
    });

    expect(listed.api_keys.map((row) => row.name)).toEqual(["Theirs"]);
    expect(listed.total).toBe(1);
  });

  it("keeps pagination and the total on the filtered set", async () => {
    table.seed({ kind: "delegated", user_id: "user", name: "One" });
    table.seed({ kind: "delegated", user_id: "user", name: "Two" });
    table.seed({ kind: "delegated", user_id: "user", name: "Three" });
    table.seed({ kind: "delegated", user_id: "other", name: "Other" });

    const first = await listApiKeys(table.deps, session("root", "super_admin"), {
      limit: 1,
      offset: 0,
      kind: "delegated",
      user: "user",
    });
    const second = await listApiKeys(table.deps, session("root", "super_admin"), {
      limit: 1,
      offset: 1,
      kind: "delegated",
      user: "user",
    });

    expect(first.total).toBe(3);
    expect(second.total).toBe(3);
    expect(first.api_keys).toHaveLength(1);
    expect(second.api_keys).toHaveLength(1);
    expect(first.api_keys[0]!.id).not.toBe(second.api_keys[0]!.id);
  });

  it("treats kind=all like an omitted kind", async () => {
    table.seed({ kind: "service", name: "Instance" });
    table.seed({ kind: "delegated", user_id: "user", name: "Mine" });

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      kind: "all",
    });

    expect(listed.api_keys).toHaveLength(2);
    expect(listed.total).toBe(2);
  });

  it("lets a non-super_admin filter their own keys", async () => {
    table.seed({ kind: "delegated", user_id: "admin", name: "Mine" });
    table.seed({ kind: "delegated", user_id: "other", name: "Theirs" });

    const listed = await listApiKeys(table.deps, session("admin", "admin"), {
      ...PAGE,
      kind: "delegated",
      user: "admin",
    });

    expect(listed.api_keys.map((row) => row.name)).toEqual(["Mine"]);
    expect(listed.total).toBe(1);
  });

  it("hides another owner's keys from a non-super_admin as not_found", async () => {
    await expect(
      listApiKeys(table.deps, session("admin", "admin"), { ...PAGE, user: "other" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("api key list state filter", () => {
  const past = new Date(NOW.getTime() - 60_000).toISOString();
  const future = new Date(NOW.getTime() + 3_600_000).toISOString();

  function seedStates(): void {
    table.seed({ name: "Never expires", expires_at: null });
    table.seed({ name: "Future", expires_at: future });
    table.seed({ name: "Expired", expires_at: past });
    table.seed({ name: "Revoked", revoked_at: NOW.toISOString() });
    table.seed({ name: "Revoked and expired", expires_at: past, revoked_at: NOW.toISOString() });
  }

  it("state=active keeps non-revoked keys with no expiry or a future one", async () => {
    seedStates();

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      state: "active",
    });

    expect(listed.api_keys.map((row) => row.name).sort()).toEqual(["Future", "Never expires"]);
    expect(listed.total).toBe(2);
  });

  it("state=expired keeps only non-revoked keys with a past expiry", async () => {
    seedStates();

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      state: "expired",
    });

    expect(listed.api_keys.map((row) => row.name)).toEqual(["Expired"]);
    expect(listed.total).toBe(1);
  });

  it("state=revoked keeps revoked keys even when they are also expired", async () => {
    seedStates();

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      state: "revoked",
    });

    expect(listed.api_keys.map((row) => row.name).sort()).toEqual([
      "Revoked",
      "Revoked and expired",
    ]);
    expect(listed.total).toBe(2);
  });

  it("state=all and an omitted state both return every key", async () => {
    seedStates();

    const all = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      state: "all",
    });
    const none = await listApiKeys(table.deps, session("root", "super_admin"), PAGE);

    expect(all.total).toBe(5);
    expect(none.total).toBe(5);
    expect(none.api_keys).toHaveLength(5);
  });

  it("keeps the filtered total when combined with kind and user", async () => {
    table.seed({ kind: "service", name: "Instance" });
    table.seed({ kind: "delegated", user_id: "user", name: "Mine" });
    table.seed({ kind: "delegated", user_id: "user", name: "Mine expired", expires_at: past });
    table.seed({ kind: "delegated", user_id: "other", name: "Theirs" });

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), {
      ...PAGE,
      kind: "delegated",
      user: "user",
      state: "active",
    });

    expect(listed.api_keys.map((row) => row.name)).toEqual(["Mine"]);
    expect(listed.total).toBe(1);
  });
});

describe("api key ownership and visibility", () => {
  it("hides another user's key from non-super_admin callers as not_found", async () => {
    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Mine",
      scopes: ["profile:read"],
    });

    await expect(getApiKey(table.deps, session("admin", "admin"), api_key.id)).rejects.toMatchObject(
      { code: "not_found" },
    );
    await expect(
      revokeApiKey(table.deps, session("admin", "admin"), api_key.id),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("never treats a delegated key as super_admin for ownership, even when its owner is one", async () => {
    const { api_key: own } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Other owner",
      scopes: ["profile:read"],
    });
    const { api_key: rootKey } = await createApiKey(table.deps, session("root", "super_admin"), {
      kind: "delegated",
      name: "Root",
      scopes: ["profile:read"],
    });

    const caller = delegated("root", ["api_keys:read", "api_keys:write", "api_keys:revoke"], "super_admin");

    const listed = await listApiKeys(table.deps, caller, PAGE);
    expect(listed.api_keys.map((row) => row.id)).toEqual([rootKey.id]);

    await expect(getApiKey(table.deps, caller, own.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(revokeApiKey(table.deps, caller, own.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("lets a super_admin session see and revoke every key", async () => {
    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Tool",
      scopes: ["profile:read"],
    });

    const listed = await listApiKeys(table.deps, session("root", "super_admin"), PAGE);
    expect(listed.api_keys).toHaveLength(1);
    expect((await getApiKey(table.deps, session("root", "super_admin"), api_key.id)).name).toBe(
      "Tool",
    );
    await revokeApiKey(table.deps, session("root", "super_admin"), api_key.id);
    expect(table.rows[0]!.revoked_at).not.toBeNull();
  });

  it("keeps a service key out of the key-management panel actions", async () => {
    const row = table.seed({ kind: "delegated", user_id: "user" });

    await expect(listApiKeys(table.deps, service(["api_keys:read"], "super_admin"), PAGE)).rejects.toMatchObject(
      { code: "insufficient_scope" },
    );
    await expect(getApiKey(table.deps, service(["api_keys:read"], "super_admin"), row.id)).rejects.toMatchObject(
      { code: "insufficient_scope" },
    );
    await expect(
      revokeApiKey(table.deps, service(["api_keys:revoke"], "super_admin"), row.id),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
    expect(row.revoked_at).toBeNull();
  });
});

describe("updateApiKey", () => {
  it("renames a key without touching anything else", async () => {
    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Old name",
      scopes: ["profile:read"],
    });
    const hash = table.rows[0]!.key_hash;

    const updated = await updateApiKey(table.deps, session("user", "user"), api_key.id, {
      name: "New name",
    });

    expect(updated).toMatchObject({
      id: api_key.id,
      name: "New name",
      kind: "delegated",
      scopes: ["profile:read"],
      user_id: "user",
    });
    expect(table.rows[0]!.name).toBe("New name");
    expect(table.rows[0]!.key_hash).toBe(hash);
    expect(table.rows[0]!.last_used_at).toBeNull();
  });

  it("hides another owner's key as not_found", async () => {
    const { api_key } = await createApiKey(table.deps, session("user", "user"), {
      kind: "delegated",
      name: "Mine",
      scopes: ["profile:read"],
    });

    await expect(
      updateApiKey(table.deps, session("other", "user"), api_key.id, { name: "Hijacked" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(table.rows[0]!.name).toBe("Mine");
  });

  it("hides a service key from a non-super_admin as not_found", async () => {
    const row = table.seed({ kind: "service", name: "Instance", role_cap: "admin" });

    await expect(
      updateApiKey(table.deps, session("admin", "admin"), row.id, { name: "Renamed" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(row.name).toBe("Instance");
  });

  it("rejects a revoked key with conflict and details.code revoked", async () => {
    const row = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Revoked",
      revoked_at: NOW.toISOString(),
    });

    await expect(
      updateApiKey(table.deps, session("user", "user"), row.id, { name: "Back" }),
    ).rejects.toMatchObject({ code: "conflict", details: { code: "revoked" } });
  });

  it("trims delegated scopes to the allowlist and rejects an empty result", async () => {
    const row = table.seed({ kind: "delegated", user_id: "admin" });

    const updated = await updateApiKey(table.deps, session("admin", "admin"), row.id, {
      scopes: ["profile:read", "settings:write", "users:read"],
    });
    expect(updated.scopes).toEqual(["profile:read", "users:read"]);

    await expect(
      updateApiKey(table.deps, session("admin", "admin"), row.id, { scopes: ["settings:write"] }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(row.scopes).toEqual(["profile:read", "users:read"]);
  });

  it("rejects a module scope the owner does not hold", async () => {
    const row = table.seed({ kind: "delegated", user_id: "user" });

    await expect(
      updateApiKey(table.deps, session("user", "user"), row.id, { scopes: ["expenses:read"] }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    table.grants.set("user", new Set(["expenses"]));
    const updated = await updateApiKey(table.deps, session("user", "user"), row.id, {
      scopes: ["expenses:read"],
    });
    expect(updated.scopes).toEqual(["expenses:read"]);
  });

  it("keeps the stored role cap as the ceiling for a service key", async () => {
    const row = table.seed({ kind: "service", name: "Service", role_cap: "admin" });

    await expect(
      updateApiKey(table.deps, session("root", "super_admin"), row.id, {
        scopes: ["users:deactivate"],
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });

    const updated = await updateApiKey(table.deps, session("root", "super_admin"), row.id, {
      scopes: ["users:read", "settings:write"],
    });
    expect(updated.scopes).toEqual(["settings:write", "users:read"]);
  });

  it("rejects an expires_at in the past", async () => {
    const row = table.seed({ kind: "delegated", user_id: "user" });

    await expect(
      updateApiKey(table.deps, session("user", "user"), row.id, {
        expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
    expect(row.expires_at).toBeNull();
  });

  it("lets an already expired key be extended", async () => {
    const row = table.seed({
      kind: "delegated",
      user_id: "user",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    const extended = new Date(NOW.getTime() + 3_600_000).toISOString();

    const updated = await updateApiKey(table.deps, session("user", "user"), row.id, {
      expires_at: extended,
    });
    expect(updated.expires_at).toBe(extended);
  });

  it("rejects reactivating an expired key when the owner already has five active", async () => {
    for (let index = 0; index < 5; index += 1) {
      table.seed({ kind: "delegated", user_id: "user", name: `Active ${index}` });
    }
    const expired = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Expired",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });

    await expect(
      updateApiKey(table.deps, session("user", "user"), expired.id, {
        expires_at: new Date(NOW.getTime() + 3_600_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "conflict", details: { code: "key_limit" } });
    expect(expired.expires_at).toBe(new Date(NOW.getTime() - 60_000).toISOString());
  });

  it("reactivates an expired key when the owner has room for one more", async () => {
    for (let index = 0; index < 4; index += 1) {
      table.seed({ kind: "delegated", user_id: "user", name: `Active ${index}` });
    }
    const expired = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Expired",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });
    const extended = new Date(NOW.getTime() + 3_600_000).toISOString();

    const updated = await updateApiKey(table.deps, session("user", "user"), expired.id, {
      expires_at: extended,
    });

    expect(updated.expires_at).toBe(extended);
  });

  it("removes the expiry with expires_at: null so the key never expires", async () => {
    const row = table.seed({
      kind: "delegated",
      user_id: "user",
      expires_at: new Date(NOW.getTime() + 3_600_000).toISOString(),
    });

    const updated = await updateApiKey(table.deps, session("user", "user"), row.id, {
      expires_at: null,
    });

    expect(updated.expires_at).toBeNull();
    expect(row.expires_at).toBeNull();
  });

  it("counts removing the expiry from an expired key against the five-key limit", async () => {
    for (let index = 0; index < 5; index += 1) {
      table.seed({ kind: "delegated", user_id: "user", name: `Active ${index}` });
    }
    const expired = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Expired",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });

    await expect(
      updateApiKey(table.deps, session("user", "user"), expired.id, { expires_at: null }),
    ).rejects.toMatchObject({ code: "conflict", details: { code: "key_limit" } });
    expect(expired.expires_at).toBe(new Date(NOW.getTime() - 60_000).toISOString());
  });

  it("removes the expiry from an expired key when the owner has room for one more", async () => {
    for (let index = 0; index < 4; index += 1) {
      table.seed({ kind: "delegated", user_id: "user", name: `Active ${index}` });
    }
    const expired = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Expired",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
    });

    const updated = await updateApiKey(table.deps, session("user", "user"), expired.id, {
      expires_at: null,
    });

    expect(updated.expires_at).toBeNull();
  });

  it("keeps refusing a revoked key when removing its expiry", async () => {
    const row = table.seed({
      kind: "delegated",
      user_id: "user",
      name: "Revoked",
      expires_at: new Date(NOW.getTime() - 60_000).toISOString(),
      revoked_at: NOW.toISOString(),
    });

    await expect(
      updateApiKey(table.deps, session("user", "user"), row.id, { expires_at: null }),
    ).rejects.toMatchObject({ code: "conflict", details: { code: "revoked" } });
  });

  it("keeps the scopes a super_admin granted when the owner edits the key", async () => {
    const { api_key } = await createApiKey(table.deps, session("root", "super_admin"), {
      kind: "delegated",
      name: "Granted",
      user_id: "user",
      scopes: ["profile:read", "users:read"],
    });
    expect(api_key.scopes).toEqual(["profile:read", "users:read"]);

    // The owner's own session has no `users:read`; editing must not strip a
    // scope that was granted to the key by someone else.
    const updated = await updateApiKey(table.deps, session("user", "user"), api_key.id, {
      name: "Renamed",
      scopes: ["profile:read", "users:read"],
    });

    expect(updated.scopes).toEqual(["profile:read", "users:read"]);
  });

  it("refuses any service caller with insufficient_scope", async () => {
    const row = table.seed({ kind: "delegated", user_id: "user" });

    await expect(
      updateApiKey(table.deps, service(["api_keys:write"], "super_admin"), row.id, {
        name: "Nope",
      }),
    ).rejects.toMatchObject({ code: "insufficient_scope" });
  });
});
