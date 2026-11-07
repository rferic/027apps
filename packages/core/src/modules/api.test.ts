import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { modulesRoute, type ModulesRouteDeps } from "./api.js";

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

function pagedDeps(rows: ModuleRow[], who: Caller = admin): ModulesRouteDeps {
  const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
  return {
    door,
    auth: async () => who,
    manifest: async () => null,
    modules: {
      db: {
        async query(_sql: string, params: unknown[] = []) {
          const [limit, offset] = params.slice(-2) as [number, number];
          const page = rows.slice(offset, offset + limit);
          const total = rows.length;
          if (page.length === 0) return { rows: [{ total }] };
          return { rows: page.map((row) => ({ ...row, total })) };
        },
      },
    },
  };
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
