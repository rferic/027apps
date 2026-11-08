import { describe, expect, it } from "vitest";
import type { Caller, DoorDeps } from "../api/types";
import type { RateLimitStorage } from "../api/rate-limit-storage";
import { invitationsRoute, type InvitationsRouteDeps } from "./api.js";
import type { InvitationsAuth } from "./service.js";

const admin: Caller = { kind: "session", userId: "admin-1", role: "admin" };

interface InvitationRow {
  id: string;
  email: string;
  name: string;
  user_category_id: null;
  expires_at: string;
  used_at: null;
  revoked_at: null;
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

const unusedAuth: InvitationsAuth = {
  async findUserByEmail() {
    return null;
  },
  async createUser() {
    return { id: "user-1", created: true };
  },
  async deleteUser() {},
};

function pagedDeps(rows: InvitationRow[], who: Caller = admin): InvitationsRouteDeps {
  const door: DoorDeps = { rateLimitStorage: countingStorage(), logger: () => {} };
  return {
    door,
    auth: async () => who,
    invitations: {
      db: {
        async query(sql: string, params: unknown[] = []) {
          if (sql.includes("invitation_modules")) return { rows: [] };
          const [limit, offset] = params as [number, number];
          const page = rows.slice(offset, offset + limit);
          const total = rows.length;
          if (page.length === 0) return { rows: [{ total }] };
          return { rows: page.map((row) => ({ ...row, total })) };
        },
      },
      auth: unusedAuth,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

function rows(count: number): InvitationRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `i${index + 1}`,
    email: `person${index + 1}@example.com`,
    name: `Person ${index + 1}`,
    user_category_id: null,
    expires_at: "2099-01-01T00:00:00.000Z",
    used_at: null,
    revoked_at: null,
    created_at: `2026-01-0${count - index}T00:00:00.000Z`,
  }));
}

async function list(route: ReturnType<typeof invitationsRoute>, url: string) {
  const res = await route(new Request(`http://local${url}`));
  return {
    status: res.status,
    body: (await res.json()) as {
      invitations: { id: string }[];
      total: number;
      limit: number;
      offset: number;
    },
  };
}

describe("invitations route pagination", () => {
  it("returns the first page with limit=2 and the total", async () => {
    const { status, body } = await list(invitationsRoute(pagedDeps(rows(3))), "/api/v1/invitations?limit=2");

    expect(status).toBe(200);
    expect(body.invitations.map((row) => row.id)).toEqual(["i1", "i2"]);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
  });

  it("returns the second page with offset=2", async () => {
    const { body } = await list(
      invitationsRoute(pagedDeps(rows(3))),
      "/api/v1/invitations?limit=2&offset=2",
    );

    expect(body.invitations.map((row) => row.id)).toEqual(["i3"]);
    expect(body.total).toBe(3);
    expect(body.offset).toBe(2);
  });

  it("caps a limit over 100", async () => {
    const { body } = await list(invitationsRoute(pagedDeps(rows(3))), "/api/v1/invitations?limit=500");

    expect(body.limit).toBe(100);
  });

  it("defaults to 20 rows", async () => {
    const { body } = await list(invitationsRoute(pagedDeps(rows(3))), "/api/v1/invitations");

    expect(body.limit).toBe(20);
  });

  it("rejects a listing without a session", async () => {
    const res = await invitationsRoute(pagedDeps(rows(1), { kind: "anon" }))(
      new Request("http://local/api/v1/invitations"),
    );

    expect(res.status).toBe(401);
  });
});

describe("invitations route status filter", () => {
  it("passes an explicit all filter to the service", async () => {
    const deps = pagedDeps(rows(1));
    const query = deps.invitations.db.query;
    const calls: { sql: string; params: unknown[] }[] = [];
    deps.invitations.db = {
      query: (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return query(sql, params);
      },
    };

    const { status } = await list(invitationsRoute(deps), "/api/v1/invitations?status=all");

    expect(status).toBe(200);
    const page = calls.find((call) => call.sql.includes("public.invitations"));
    expect(page?.params[2]).toBe("all");
  });

  it("passes a concrete status to the service", async () => {
    const deps = pagedDeps(rows(1));
    const query = deps.invitations.db.query;
    const calls: { sql: string; params: unknown[] }[] = [];
    deps.invitations.db = {
      query: (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return query(sql, params);
      },
    };

    await list(invitationsRoute(deps), "/api/v1/invitations?status=pending");

    const page = calls.find((call) => call.sql.includes("public.invitations"));
    expect(page?.params[2]).toBe("pending");
  });

  it("rejects an unknown status instead of guessing", async () => {
    const res = await invitationsRoute(pagedDeps(rows(1)))(
      new Request("http://local/api/v1/invitations?status=maybe"),
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("validation_failed");
  });
});
