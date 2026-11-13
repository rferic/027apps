import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import {
  modulesRoute,
  moduleGrantsRoute,
  myModulesRoute,
  type ModulesRouteDeps,
} from "./api.js";

const admin: Caller = { kind: "session", userId: "admin-1", role: "admin" };

interface ModuleRow {
  key: string;
  name: string;
  version: string;
  state: string;
  is_public: boolean;
  mcp_exposed: string;
  installed_at: string;
  updated_at: string;
}

function countingStorage(): RateLimitStorage {
  const counts = new Map<string, number>();
  return {
    async increment(key) {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { count };
    },
  };
}

/** A fake registry that applies the same filters the SQL applies. */
function pagedDeps(rows: ModuleRow[], who: Caller = admin, grants: string[] = []): ModulesRouteDeps {
  const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
  return {
    door,
    auth: async () => who,
    manifest: async () => null,
    modules: {
      db: {
        async query(_sql: string, params: unknown[] = []) {
          // The non-admin branch binds the user id first and filters in SQL.
          if (typeof params[0] === "string") {
            const [limit, offset] = [Number(params[1]), Number(params[2])];
            const filtered = rows.filter(
              (row) => row.state === "active" && (row.is_public || grants.includes(row.key)),
            );
            const page = filtered.slice(offset, offset + limit);
            return { rows: page.length === 0 ? [{ total: filtered.length }] : page.map((row) => ({ ...row, total: filtered.length })) };
          }
          const [limit, offset] = params.filter(
            (value): value is number => typeof value === "number",
          ) as [number, number];
          const state = params.find(
            (value): value is string =>
              value === "installed" || value === "active" || value === "disabled",
          );
          const visibility = params.find((value): value is boolean => typeof value === "boolean");
          const filtered = rows.filter(
            (row) =>
              (!state || row.state === state) &&
              (visibility === undefined || row.is_public === visibility),
          );
          const page = filtered.slice(offset, offset + limit);
          const total = filtered.length;
          if (page.length === 0) return { rows: [{ total }] };
          return { rows: page.map((row) => ({ ...row, total })) };
        },
      },
    },
  };
}

/** A catalogue with one module of each state and both visibilities. */
function mixedRows(): ModuleRow[] {
  const base = rows(1)[0];
  return [
    { ...base, key: "installed-public", state: "installed", is_public: true },
    { ...base, key: "active-public", state: "active", is_public: true },
    { ...base, key: "active-private", state: "active", is_public: false },
    { ...base, key: "disabled-private", state: "disabled", is_public: false },
    { ...base, key: "disabled-public", state: "disabled", is_public: true },
  ];
}

function rows(count: number): ModuleRow[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `module-${index + 1}`,
    name: `Module ${index + 1}`,
    version: "1.0.0",
    state: "active",
    is_public: index % 2 === 0,
    mcp_exposed: "read",
    installed_at: `2026-01-0${count - index}T00:00:00.000Z`,
    updated_at: `2026-01-0${count - index}T00:00:00.000Z`,
  }));
}

async function list(route: ReturnType<typeof modulesRoute>, url: string) {
  const res = await route(new Request(`http://local${url}`));
  return {
    status: res.status,
    body: (await res.json()) as {
      modules: { key: string }[];
      total: number;
      limit: number;
      offset: number;
    },
  };
}

describe("module grants route", () => {
  function grantsDeps(input: {
    exists?: boolean;
    users?: { id: string; display_name: string }[];
    categories?: { id: string; name: string }[];
    who?: Caller;
  }): ModulesRouteDeps {
    const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
    return {
      door,
      auth: async () => input.who ?? admin,
      manifest: async () => null,
      modules: {
        db: {
          async query(sql: string) {
            if (!sql.includes("json_agg")) return { rows: [] };
            if (input.exists === false) return { rows: [] };
            return { rows: [{ users: input.users ?? [], categories: input.categories ?? [] }] };
          },
        },
      },
    };
  }

  async function grants(deps: ModulesRouteDeps, key = "expenses") {
    const res = await moduleGrantsRoute(deps)(new Request("http://local"), key);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  it("returns the users and categories with access", async () => {
    const { status, body } = await grants(
      grantsDeps({
        users: [{ id: "u-1", display_name: "Ana" }],
        categories: [{ id: "c-1", name: "Familia" }],
      }),
    );

    expect(status).toBe(200);
    expect(body).toEqual({
      users: [{ id: "u-1", display_name: "Ana" }],
      categories: [{ id: "c-1", name: "Familia" }],
    });
  });

  it("requires modules:manage, not modules:read", async () => {
    const delegated: Caller = {
      kind: "delegated",
      keyId: "key-1",
      userId: "user-1",
      scopes: ["modules:read"],
      roleCap: "user",
    };
    const { status, body } = await grants(grantsDeps({ who: delegated }));

    expect(status).toBe(403);
    expect((body as { error: { code: string } }).error.code).toBe("insufficient_scope");
  });

  it("answers 404 for a module that does not exist", async () => {
    const { status, body } = await grants(grantsDeps({ exists: false }));

    expect(status).toBe(404);
    expect((body as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("answers 400 for a malformed key", async () => {
    const { status, body } = await grants(grantsDeps({}), "Not A Key");

    expect(status).toBe(400);
    expect((body as { error: { code: string } }).error.code).toBe("validation_failed");
  });
});

describe("modules route pagination", () => {
  it("returns the first page with limit=2 and the total", async () => {
    const { status, body } = await list(modulesRoute(pagedDeps(rows(3))), "/api/v1/modules?limit=2");

    expect(status).toBe(200);
    expect(body.modules.map((row) => row.key)).toEqual(["module-1", "module-2"]);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("returns the second page with offset=2", async () => {
    const { body } = await list(modulesRoute(pagedDeps(rows(3))), "/api/v1/modules?limit=2&offset=2");

    expect(body.modules.map((row) => row.key)).toEqual(["module-3"]);
    expect(body.total).toBe(3);
    expect(body.offset).toBe(2);
  });

  it("caps a limit over 100", async () => {
    const { body } = await list(modulesRoute(pagedDeps(rows(3))), "/api/v1/modules?limit=500");

    expect(body.limit).toBe(100);
  });

  it("defaults to 20 rows", async () => {
    const { body } = await list(modulesRoute(pagedDeps(rows(3))), "/api/v1/modules");

    expect(body.limit).toBe(20);
  });

  it("rejects a listing without a session", async () => {
    const res = await modulesRoute(pagedDeps(rows(1), { kind: "anon" }))(
      new Request("http://local/api/v1/modules"),
    );

    expect(res.status).toBe(401);
  });
});

describe("modules route filters", () => {
  it("returns the whole catalogue when neither filter is set", async () => {
    const { status, body } = await list(modulesRoute(pagedDeps(mixedRows())), "/api/v1/modules");

    expect(status).toBe(200);
    expect(body.modules).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it.each(["installed", "active", "disabled"] as const)(
    "filters by state=%s and the total counts only those rows",
    async (state) => {
      const { status, body } = await list(
        modulesRoute(pagedDeps(mixedRows())),
        `/api/v1/modules?state=${state}`,
      );

      expect(status).toBe(200);
      expect(body.modules.every((row) => row.key.includes(state))).toBe(true);
      const expected = { installed: 1, active: 2, disabled: 2 }[state];
      expect(body.modules).toHaveLength(expected);
      expect(body.total).toBe(expected);
    },
  );

  it("filters public=yes", async () => {
    const { body } = await list(modulesRoute(pagedDeps(mixedRows())), "/api/v1/modules?public=yes");

    expect(body.modules.map((row) => row.key)).toEqual([
      "installed-public",
      "active-public",
      "disabled-public",
    ]);
    expect(body.total).toBe(3);
  });

  it("filters public=no", async () => {
    const { body } = await list(modulesRoute(pagedDeps(mixedRows())), "/api/v1/modules?public=no");

    expect(body.modules.map((row) => row.key)).toEqual(["active-private", "disabled-private"]);
    expect(body.total).toBe(2);
  });

  it("combines state and public into the same count", async () => {
    const { body } = await list(
      modulesRoute(pagedDeps(mixedRows())),
      "/api/v1/modules?state=active&public=no",
    );

    expect(body.modules.map((row) => row.key)).toEqual(["active-private"]);
    expect(body.total).toBe(1);
  });

  it("keeps total on the filtered set across pages", async () => {
    const { body } = await list(
      modulesRoute(pagedDeps(mixedRows())),
      "/api/v1/modules?state=active&limit=1&offset=1",
    );

    expect(body.modules.map((row) => row.key)).toEqual(["active-private"]);
    expect(body.total).toBe(2);
    expect(body.offset).toBe(1);
  });

  it("treats state=all and public=all as no filter", async () => {
    const { body } = await list(
      modulesRoute(pagedDeps(mixedRows())),
      "/api/v1/modules?state=all&public=all",
    );

    expect(body.modules).toHaveLength(5);
    expect(body.total).toBe(5);
  });

  it("rejects an unknown state with validation_failed", async () => {
    const res = await modulesRoute(pagedDeps(mixedRows()))(
      new Request("http://local/api/v1/modules?state=broken"),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_failed");
  });

  it("rejects an unknown public value with validation_failed", async () => {
    const res = await modulesRoute(pagedDeps(mixedRows()))(
      new Request("http://local/api/v1/modules?public=maybe"),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_failed");
  });
});

describe("GET /api/v1/me/modules", () => {
  it("gives a user the active public modules and the granted private ones", async () => {
    const user: Caller = { kind: "session", userId: "user-1", role: "user" };
    const deps = pagedDeps(mixedRows(), user, ["active-private"]);
    const result = await list(myModulesRoute(deps), "/api/v1/me/modules");

    expect(result.status).toBe(200);
    expect(result.body.modules.map((module) => module.key).sort()).toEqual([
      "active-private",
      "active-public",
    ]);
    expect(result.body.total).toBe(2);
  });

  it("gives an admin every module, including installed and disabled ones", async () => {
    const result = await list(myModulesRoute(pagedDeps(mixedRows())), "/api/v1/me/modules");
    expect(result.status).toBe(200);
    expect(result.body.total).toBe(5);
  });

  it("answers 401 for an anonymous caller", async () => {
    const deps = pagedDeps(mixedRows(), { kind: "anon" });
    const res = await myModulesRoute(deps)(new Request("http://local/api/v1/me/modules"));
    expect(res.status).toBe(401);
  });
});
