import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { purgeUserRoute, userModulesRoute, usersRoute, type UsersRouteDeps } from "./api.js";
import type { Role } from "./service.js";

interface ProfileRow {
  id: string;
  display_name: string;
  locale: string;
  timezone: string;
  role: Role;
  created_at: string;
  deactivated_at: string | null;
}

function profile(id: string, overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id,
    display_name: id,
    locale: "en",
    timezone: "UTC",
    role: "user",
    created_at: "2026-01-01T00:00:00.000Z",
    deactivated_at: null,
    ...overrides,
  };
}

type CategoryLink = { id: string; name: string };

type ModuleGrant = { user: string; key: string; name: string; revoked?: boolean; state?: string };

/** In-memory database for the reads and writes the users service issues. */
function dbFor(
  rows: ProfileRow[],
  memberships: Record<string, CategoryLink[]> = {},
  grants: ModuleGrant[] = [],
) {
  const profiles = new Map(rows.map((row) => [row.id, { ...row }]));
  const categoriesOf = (id: string): CategoryLink[] => memberships[id] ?? [];
  return {
    profiles,
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith("select p.id,") && sql.includes("where p.id = $1")) {
        const row = profiles.get(String(params[0]));
        return { rows: row ? [{ ...row, categories: categoriesOf(row.id) }] : [] };
      }
      if (sql.includes("role = 'super_admin' and deactivated_at is null")) {
        const roots = [...profiles.values()]
          .filter((row) => row.role === "super_admin" && row.deactivated_at === null)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        return { rows: roots[0] ? [{ id: roots[0].id }] : [] };
      }
      if (sql.startsWith("select id from public.profiles where role = 'super_admin'")) {
        const roots = [...profiles.values()]
          .filter((row) => row.role === "super_admin")
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        return { rows: roots[0] ? [{ id: roots[0].id }] : [] };
      }
      if (sql.startsWith("select count(*)::int as n from public.profiles")) {
        const n = [...profiles.values()].filter(
          (row) => row.role === "super_admin" && row.deactivated_at === null,
        ).length;
        return { rows: [{ n }] };
      }
      if (sql.startsWith("select p.id")) {
        const [pattern, role, state, category, limit, offset] = params as [
          string | null,
          Role | null,
          boolean | null,
          string | null,
          number,
          number,
        ];
        const rowsOnPage = [...profiles.values()]
          .filter((row) => !pattern || row.display_name.includes(pattern.replace(/%/g, "")))
          .filter((row) => !role || row.role === role)
          .filter((row) => state === null || (row.deactivated_at === null) === state)
          .filter((row) => !category || categoriesOf(row.id).some((c) => c.id === category))
          .slice(offset, offset + limit)
          .map((row) => ({ ...row, categories: categoriesOf(row.id) }));
        return { rows: rowsOnPage };
      }
      if (sql.startsWith("select count(*) filter")) {
        const [pattern, role, state, category] = params as [
          string | null,
          Role | null,
          boolean | null,
          string | null,
        ];
        const matching = [...profiles.values()]
          .filter((row) => !pattern || row.display_name.includes(pattern.replace(/%/g, "")))
          .filter((row) => !role || row.role === role)
          .filter((row) => !category || categoriesOf(row.id).some((c) => c.id === category));
        return {
          rows: [
            {
              n: matching.filter(
                (row) => state === null || (row.deactivated_at === null) === state,
              ).length,
              active_total: matching.filter((row) => row.deactivated_at === null).length,
            },
          ],
        };
      }
      if (sql.startsWith("select m.key, m.name")) {
        const [id, ownId] = params as [string, string | null];
        if (!profiles.has(id) || (ownId !== null && ownId !== id)) return { rows: [] };
        const live = grants
          .filter((grant) => grant.user === id && grant.revoked !== true)
          .filter((grant) => (grant.state ?? "active") !== "disabled")
          .map((grant) => ({ key: grant.key, name: grant.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        return { rows: live.length > 0 ? live : [{ key: null, name: null }] };
      }
      if (sql.startsWith("delete from auth.users")) {
        profiles.delete(String(params[0]));
        return { rows: [] };
      }
      if (sql.startsWith("update public.") || sql.startsWith("insert into public.event_outbox")) {
        return { rows: [] };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    },
  };
}

function storage(): RateLimitStorage {
  return { increment: async () => ({ count: 1 }) };
}

function deps(db: ReturnType<typeof dbFor>, who: Caller): UsersRouteDeps {
  const door: DoorDeps = { rateLimitStorage: storage(), logger: () => {} };
  return { door, auth: async () => who, users: { db } };
}

const ROOT = profile("root", {
  role: "super_admin",
  created_at: "2025-01-01T00:00:00.000Z",
});
const OFF = profile("off", { deactivated_at: "2026-02-01T00:00:00.000Z" });

describe("DELETE /api/v1/users/{id}/purge", () => {
  it("returns 204 and deletes a deactivated profile", async () => {
    const db = dbFor([ROOT, OFF]);
    const route = purgeUserRoute(deps(db, { kind: "session", userId: "root", role: "super_admin" }));

    const res = await route(
      new Request("http://local/api/v1/users/off/purge", { method: "DELETE" }),
      "off",
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(db.profiles.has("off")).toBe(false);
  });

  it("forbids an admin without users:deactivate", async () => {
    const db = dbFor([ROOT, OFF]);
    const route = purgeUserRoute(deps(db, { kind: "session", userId: "admin", role: "admin" }));

    const res = await route(
      new Request("http://local/api/v1/users/off/purge", { method: "DELETE" }),
      "off",
    );

    expect(res.status).toBe(403);
    expect(db.profiles.has("off")).toBe(true);
  });

  it("answers 409 while the profile is still active", async () => {
    const db = dbFor([ROOT, profile("active")]);
    const route = purgeUserRoute(deps(db, { kind: "session", userId: "root", role: "super_admin" }));

    const res = await route(
      new Request("http://local/api/v1/users/active/purge", { method: "DELETE" }),
      "active",
    );

    expect(res.status).toBe(409);
    expect(db.profiles.has("active")).toBe(true);
  });

  it("answers 404 when the profile does not exist", async () => {
    const db = dbFor([ROOT]);
    const route = purgeUserRoute(deps(db, { kind: "session", userId: "root", role: "super_admin" }));

    const res = await route(
      new Request("http://local/api/v1/users/missing/purge", { method: "DELETE" }),
      "missing",
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/users state", () => {
  it("defaults to active and accepts state=all explicitly", async () => {
    const db = dbFor([ROOT, OFF]);
    const route = usersRoute(deps(db, { kind: "session", userId: "root", role: "admin" }));

    const defaulted = await route(new Request("http://local/api/v1/users"));
    const all = await route(new Request("http://local/api/v1/users?state=all"));

    expect(defaulted.status).toBe(200);
    const defaultedBody = (await defaulted.json()) as { users: { id: string }[]; total: number };
    expect(defaultedBody.users.map((user) => user.id)).toEqual(["root"]);
    expect(defaultedBody.total).toBe(1);

    const allBody = (await all.json()) as { users: { id: string }[]; total: number };
    expect(allBody.users.map((user) => user.id)).toEqual(["root", "off"]);
    expect(allBody.total).toBe(2);
  });

  it("rejects an unknown state with a validation error", async () => {
    const db = dbFor([ROOT]);
    const route = usersRoute(deps(db, { kind: "session", userId: "root", role: "admin" }));

    const res = await route(new Request("http://local/api/v1/users?state=disabled"));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "validation_failed",
    );
  });
});

describe("GET /api/v1/users/{id}/modules", () => {
  const ANA = "11111111-1111-4111-8111-111111111111";
  const MISSING = "33333333-3333-4333-8333-333333333333";
  const ANA_PROFILE = profile(ANA, { created_at: "2026-01-02T00:00:00.000Z" });
  const ADMIN = { kind: "session", userId: "root", role: "admin" } as const;

  it("returns the live granted modules ordered by name", async () => {
    const db = dbFor(
      [ROOT, ANA_PROFILE],
      {},
      [
        { user: ANA, key: "recetas", name: "Recetas" },
        { user: ANA, key: "compras", name: "Compras" },
        { user: ANA, key: "old", name: "Old", revoked: true },
        { user: ANA, key: "off", name: "Off", state: "disabled" },
      ],
    );
    const route = userModulesRoute(deps(db, ADMIN));

    const res = await route(new Request(`http://local/api/v1/users/${ANA}/modules`), ANA);

    expect(res.status).toBe(200);
    expect((await res.json()) as { modules: unknown }).toMatchObject({
      modules: [
        { key: "compras", name: "Compras" },
        { key: "recetas", name: "Recetas" },
      ],
    });
  });

  it("returns an empty list for a profile without modules", async () => {
    const db = dbFor([ROOT, ANA_PROFILE]);
    const route = userModulesRoute(deps(db, ADMIN));

    const res = await route(new Request(`http://local/api/v1/users/${ANA}/modules`), ANA);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ modules: [] });
  });

  it("answers 404 for a profile that does not exist", async () => {
    const db = dbFor([ROOT]);
    const route = userModulesRoute(deps(db, ADMIN));

    const res = await route(new Request(`http://local/api/v1/users/${MISSING}/modules`), MISSING);

    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("rejects an id that is not a uuid", async () => {
    const db = dbFor([ROOT]);
    const route = userModulesRoute(deps(db, ADMIN));

    const res = await route(new Request("http://local/api/v1/users/ana/modules"), "ana");

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "validation_failed",
    );
  });

  it("forbids a caller without users:read", async () => {
    const db = dbFor([ROOT, ANA_PROFILE]);
    const route = userModulesRoute(deps(db, { kind: "session", userId: "ana", role: "user" }));

    const res = await route(new Request(`http://local/api/v1/users/${ANA}/modules`), ANA);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/users category", () => {
  const ALPHA = "11111111-1111-4111-8111-111111111111";
  const BETA = "22222222-2222-4222-8222-222222222222";
  const ANA = profile("ana", { role: "admin", created_at: "2026-01-02T00:00:00.000Z" });
  const LUIS = profile("luis", { role: "user", created_at: "2026-01-03T00:00:00.000Z" });
  const MEMBERSHIPS = {
    ana: [{ id: ALPHA, name: "Alpha" }],
    luis: [
      { id: ALPHA, name: "Alpha" },
      { id: BETA, name: "Beta" },
    ],
  };

  it("returns only the members of the category with their categories and the correct total", async () => {
    const db = dbFor([ROOT, ANA, LUIS], MEMBERSHIPS);
    const route = usersRoute(deps(db, { kind: "session", userId: "root", role: "admin" }));

    const res = await route(
      new Request(`http://local/api/v1/users?category=${ALPHA}&state=all`),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: { id: string; categories: CategoryLink[] }[];
      total: number;
    };
    expect(body.users.map((user) => user.id)).toEqual(["ana", "luis"]);
    expect(body.users[0]?.categories).toEqual([{ id: ALPHA, name: "Alpha" }]);
    expect(body.users[1]?.categories).toEqual([
      { id: ALPHA, name: "Alpha" },
      { id: BETA, name: "Beta" },
    ]);
    expect(body.total).toBe(2);
  });

  it("rejects a category that is not a uuid", async () => {
    const db = dbFor([ROOT]);
    const route = usersRoute(deps(db, { kind: "session", userId: "root", role: "admin" }));

    const res = await route(new Request("http://local/api/v1/users?category=alpha"));

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "validation_failed",
    );
  });
});
