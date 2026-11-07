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
