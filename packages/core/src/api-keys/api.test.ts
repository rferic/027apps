import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { apiKeysRoute, type ApiKeysRouteDeps } from "./api.js";

const admin: Caller = { kind: "session", userId: "admin-1", role: "super_admin" };

interface KeyRow {
  id: string;
  kind: "service" | "delegated";
  name: string;
  scopes: string[];
  user_id: string | null;
  role_cap: null;
  expires_at: null;
  revoked_at: null;
  last_used_at: null;
  created_at: string;
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

function pagedDeps(rows: KeyRow[], who: Caller = admin): ApiKeysRouteDeps {
  const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
  return {
    door,
    auth: async () => who,
    apiKeys: {
      db: {
        async query(sql: string, params: unknown[] = []) {
          const paged = params.slice(-2) as [number, number];
          const [limit, offset] = paged;
          const page = rows.slice(offset, offset + limit);
          const total = rows.length;
          if (page.length === 0) return { rows: [{ total }] };
          return { rows: page.map((row) => ({ ...row, total })) };
        },
      },
    },
  };
}

function rows(count: number): KeyRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `k${index + 1}`,
    kind: "service",
    name: `Key ${index + 1}`,
    scopes: ["users:read"],
    user_id: null,
    role_cap: null,
    expires_at: null,
    revoked_at: null,
    last_used_at: null,
    created_at: `2026-01-0${count - index}T00:00:00.000Z`,
  }));
}

async function list(route: ReturnType<typeof apiKeysRoute>, url: string) {
  const res = await route(new Request(`http://local${url}`));
  return {
    status: res.status,
    body: (await res.json()) as {
      api_keys: { id: string }[];
      total: number;
      limit: number;
      offset: number;
    },
  };
}

describe("api keys route pagination", () => {
  it("returns the first page with limit=2 and the total", async () => {
    const { status, body } = await list(apiKeysRoute(pagedDeps(rows(3))), "/api/v1/api-keys?limit=2");

    expect(status).toBe(200);
    expect(body.api_keys.map((row) => row.id)).toEqual(["k1", "k2"]);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("returns the second page with offset=2", async () => {
    const { body } = await list(
      apiKeysRoute(pagedDeps(rows(3))),
      "/api/v1/api-keys?limit=2&offset=2",
    );

    expect(body.api_keys.map((row) => row.id)).toEqual(["k3"]);
    expect(body.total).toBe(3);
    expect(body.offset).toBe(2);
  });

  it("caps a limit over 100", async () => {
    const { body } = await list(apiKeysRoute(pagedDeps(rows(3))), "/api/v1/api-keys?limit=500");

    expect(body.limit).toBe(100);
  });

  it("defaults to 20 rows", async () => {
    const { body } = await list(apiKeysRoute(pagedDeps(rows(3))), "/api/v1/api-keys");

    expect(body.limit).toBe(20);
  });

  it("rejects a listing without a session", async () => {
    const res = await apiKeysRoute(pagedDeps(rows(1), { kind: "anon" }))(
      new Request("http://local/api/v1/api-keys"),
    );

    expect(res.status).toBe(401);
  });
});
