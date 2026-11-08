import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { addCategoryMemberRoute, userCategoriesRoute, type UserCategoriesRouteDeps } from "./api.js";
import type { UserCategoriesDeps } from "./service.js";

const CATEGORY_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "22222222-2222-2222-2222-222222222222";
const admin: Caller = { kind: "session", userId: "admin-1", role: "admin" };

/** The route validates rate limits before the service runs, so any row satisfies the checks. */
const categories: UserCategoriesDeps = {
  db: { query: async () => ({ rows: [{}] }) },
};

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

function deps(): UserCategoriesRouteDeps {
  const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
  return { door, auth: async () => admin, categories };
}

function addMemberRequest(): Request {
  return new Request(`http://local/api/v1/user-categories/${CATEGORY_ID}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("user-categories route rate limits", () => {
  it("allows 60 writes per minute by default (one row per UI interaction)", async () => {
    const ADD = addCategoryMemberRoute(deps());

    for (let i = 0; i < 60; i += 1) {
      expect((await ADD(addMemberRequest(), CATEGORY_ID, USER_ID)).status).toBe(204);
    }

    const overLimit = await ADD(addMemberRequest(), CATEGORY_ID, USER_ID);
    expect(overLimit.status).toBe(429);
    expect(((await overLimit.json()) as { error: { code: string } }).error.code).toBe(
      "rate_limited",
    );
  });

  it("allows 240 reads per minute by default", async () => {
    const GET = userCategoriesRoute(deps());
    const request = () => new Request("http://local/api/v1/user-categories");

    for (let i = 0; i < 240; i += 1) {
      expect((await GET(request())).status).toBe(200);
    }

    expect((await GET(request())).status).toBe(429);
  });

  it("still honours a per-route override", async () => {
    const limited: UserCategoriesRouteDeps = { ...deps(), rateLimits: { write: 2 } };
    const ADD = addCategoryMemberRoute(limited);

    expect((await ADD(addMemberRequest(), CATEGORY_ID, USER_ID)).status).toBe(204);
    expect((await ADD(addMemberRequest(), CATEGORY_ID, USER_ID)).status).toBe(204);
    expect((await ADD(addMemberRequest(), CATEGORY_ID, USER_ID)).status).toBe(429);
  });
});

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
}

/** Mimics the paged CTE: a page of rows plus the same `total` on each row. */
function pagedCategories(rows: CategoryRow[]): UserCategoriesRouteDeps {
  const db = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("user_category_modules")) return { rows: [] };
      const [limit, offset] = params as [number, number];
      const page = rows.slice(offset, offset + limit);
      const total = rows.length;
      if (page.length === 0) return { rows: [{ total }] };
      return { rows: page.map((row) => ({ ...row, total })) };
    },
  };
  return { door: deps().door, auth: async () => admin, categories: { db } };
}

function categoryRows(count: number): CategoryRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `c${index + 1}`,
    name: `Category ${index + 1}`,
    slug: `category-${index + 1}`,
    created_at: `2026-01-0${count - index}T00:00:00.000Z`,
    member_count: index,
  }));
}

async function listBody(route: ReturnType<typeof userCategoriesRoute>, url: string) {
  const res = await route(new Request(`http://local${url}`));
  return {
    status: res.status,
    body: (await res.json()) as {
      categories: CategoryRow[];
      total: number;
      limit: number;
      offset: number;
    },
  };
}

describe("user-categories route pagination", () => {
  it("returns the first page with limit=2 and the instance-wide total", async () => {
    const route = userCategoriesRoute(pagedCategories(categoryRows(3)));

    const { status, body } = await listBody(route, "/api/v1/user-categories?limit=2");

    expect(status).toBe(200);
    expect(body.categories.map((row) => row.id)).toEqual(["c1", "c2"]);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("returns the second page with offset=2", async () => {
    const route = userCategoriesRoute(pagedCategories(categoryRows(3)));

    const { body } = await listBody(route, "/api/v1/user-categories?limit=2&offset=2");

    expect(body.categories.map((row) => row.id)).toEqual(["c3"]);
    expect(body.total).toBe(3);
    expect(body.offset).toBe(2);
  });

  it("clamps a limit above the hard cap", async () => {
    const route = userCategoriesRoute(pagedCategories(categoryRows(3)));

    const { body } = await listBody(route, "/api/v1/user-categories?limit=1000");

    expect(body.limit).toBe(100);
  });

  it("defaults the limit to 20", async () => {
    const route = userCategoriesRoute(pagedCategories(categoryRows(3)));

    const { body } = await listBody(route, "/api/v1/user-categories");

    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("rejects a listing without a session", async () => {
    const anon: UserCategoriesRouteDeps = {
      ...pagedCategories(categoryRows(1)),
      auth: async () => ({ kind: "anon" }),
    };

    const res = await userCategoriesRoute(anon)(new Request("http://local/api/v1/user-categories"));

    expect(res.status).toBe(401);
  });
});
