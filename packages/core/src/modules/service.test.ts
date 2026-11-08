import { describe, expect, it } from "vitest";
import type { QueryClient } from "../api/rate-limit-storage.js";
import type { Caller } from "../api/types.js";
import {
  getModule,
  listModuleGrants,
  uninstallModule,
  type ModuleGrantCategory,
  type ModuleGrantUser,
  type ModulesDeps,
} from "./service.js";

const admin: Caller = { kind: "session", userId: "admin-1", role: "admin" };
const plainUser: Caller = { kind: "session", userId: "user-1", role: "user" };
const root: Caller = { kind: "session", userId: "root-1", role: "super_admin" };
const serviceAdmin: Caller = {
  kind: "service",
  keyId: "key-1",
  scopes: ["modules:manage"],
  roleCap: "admin",
};
const delegatedRead: Caller = {
  kind: "delegated",
  keyId: "key-2",
  userId: "user-1",
  scopes: ["modules:read"],
  roleCap: "user",
};

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

function grantsDeps(input: {
  exists?: boolean;
  users?: ModuleGrantUser[];
  categories?: ModuleGrantCategory[];
}): { deps: ModulesDeps; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const db: QueryClient = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (sql.includes("json_agg")) {
        if (input.exists === false) return { rows: [] };
        return { rows: [{ users: input.users ?? [], categories: input.categories ?? [] }] };
      }
      return { rows: [] };
    },
  };
  return { deps: { db }, queries };
}

describe("listModuleGrants", () => {
  it("returns the active users and the assigned categories of the module", async () => {
    const { deps } = grantsDeps({
      users: [
        { id: "u-ana", display_name: "Ana" },
        { id: "u-zoe", display_name: "Zoe" },
      ],
      categories: [
        { id: "c-amigos", name: "Amigos" },
        { id: "c-familia", name: "Familia" },
      ],
    });

    await expect(listModuleGrants(deps, admin, "expenses")).resolves.toEqual({
      users: [
        { id: "u-ana", display_name: "Ana" },
        { id: "u-zoe", display_name: "Zoe" },
      ],
      categories: [
        { id: "c-amigos", name: "Amigos" },
        { id: "c-familia", name: "Familia" },
      ],
    });
  });

  it("excludes revoked grants and orders deterministically in one statement", async () => {
    const { deps, queries } = grantsDeps({ users: [], categories: [] });

    await listModuleGrants(deps, admin, "expenses");

    expect(queries).toHaveLength(1);
    const sql = queries[0]!.sql;
    expect(sql).toContain("from public.module_registry");
    expect(sql).toContain("u.revoked_at is null");
    expect(sql).toContain("order by p.display_name asc, p.id asc");
    expect(sql).toContain("order by c.name asc, c.id asc");
    expect(sql).toContain("coalesce");
    expect(queries[0]!.params).toEqual(["expenses"]);
  });

  it("returns empty arrays when the module has no grants", async () => {
    const { deps } = grantsDeps({ users: [], categories: [] });

    await expect(listModuleGrants(deps, admin, "expenses")).resolves.toEqual({
      users: [],
      categories: [],
    });
  });

  it("rejects a module that does not exist", async () => {
    const { deps } = grantsDeps({ exists: false });

    await expect(listModuleGrants(deps, admin, "ghost")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("rejects a key that is not a module key before touching the database", async () => {
    const { deps, queries } = grantsDeps({});

    await expect(listModuleGrants(deps, admin, "Not A Key")).rejects.toMatchObject({
      code: "validation_failed",
    });
    expect(queries).toHaveLength(0);
  });

  it("requires an administrator, not just modules:read", async () => {
    const { deps, queries } = grantsDeps({});

    await expect(listModuleGrants(deps, plainUser, "expenses")).rejects.toMatchObject({
      code: "insufficient_scope",
    });
    await expect(listModuleGrants(deps, delegatedRead, "expenses")).rejects.toMatchObject({
      code: "insufficient_scope",
    });
    expect(queries).toHaveLength(0);
  });

  it("accepts a service key with an admin role cap", async () => {
    const { deps } = grantsDeps({ users: [], categories: [] });

    await expect(listModuleGrants(deps, serviceAdmin, "expenses")).resolves.toEqual({
      users: [],
      categories: [],
    });
  });
});

describe("manifest_digest", () => {
  it("is part of the module view, not a hidden column", async () => {
    const queries: RecordedQuery[] = [];
    const db: QueryClient = {
      async query(sql: string, params: unknown[] = []) {
        queries.push({ sql, params });
        if (sql.includes("from public.module_registry")) {
          return {
            rows: [
              {
                key: "expenses",
                name: "Expenses",
                version: "1.0.0",
                state: "active",
                is_public: false,
                mcp_exposed: "read",
                manifest_digest: "sha256:abc",
                installed_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const module = await getModule({ db }, admin, "expenses");

    expect(module.manifest_digest).toBe("sha256:abc");
    expect(queries[0]!.sql).toContain("manifest_digest");
  });
});

const UNINSTALL_MANIFEST = {
  key: "inventory",
  name: "Inventory",
  branding: { description: "Stock", icon: "assets/icon.svg", color: "teal" },
  version: "1.0.0",
  is_public: false,
  migrations: [],
  settings: [],
  i18n: ["en"],
  scopes: [],
  mcp_tools: [],
  channels: [],
  events: [],
  hooks: {},
  admin_pages: [],
  docs: { readme: "README.md" },
};

function uninstallDeps(input: { grants?: number; applied?: string[] }): ModulesDeps {
  const db: QueryClient = {
    async query(sql: string) {
      if (sql.includes("from public.module_registry")) {
        return {
          rows: [
            {
              key: "inventory",
              name: "Inventory",
              version: "1.0.0",
              state: "active",
              is_public: false,
              mcp_exposed: "read",
              manifest_digest: "sha256:abc",
              installed_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("as grants")) {
        return { rows: [{ grants: input.grants ?? 0, category_grants: 0 }] };
      }
      if (sql.includes("from public.module_migrations")) {
        return { rows: (input.applied ?? []).map((version) => ({ version })) };
      }
      return { rows: [] };
    },
  };
  return {
    db,
    withTransaction: async (fn) => fn(db),
    readFile: async (path) =>
      path.endsWith(".svg")
        ? '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>'
        : "# Inventory",
    moduleRoot: () => "/modules/inventory",
  };
}

async function captureFailure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  );
}

describe("uninstallModule", () => {
  it("tags the active-grants conflict so the panel can confirm a second time", async () => {
    const deps = uninstallDeps({ grants: 2 });

    await expect(
      uninstallModule(deps, root, "inventory", UNINSTALL_MANIFEST, false),
    ).rejects.toMatchObject({
      code: "conflict",
      details: { code: "grants_active" },
    });
  });

  it("leaves the migration conflict untagged: a retry cannot fix it", async () => {
    const deps = uninstallDeps({ applied: ["2.0.0"] });

    const error = await captureFailure(
      uninstallModule(deps, root, "inventory", UNINSTALL_MANIFEST, false),
    );

    expect(error).toMatchObject({ code: "conflict" });
    expect((error as { details?: unknown }).details).toBeUndefined();
  });
});
