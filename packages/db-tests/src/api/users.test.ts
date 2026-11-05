import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  deactivateUserRoute,
  updateUserRoute,
  userRoute,
  usersRoute,
  type UsersRouteDeps,
} from "@027apps/core/users/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const door: DoorDeps = {
  rateLimitStorage: { increment: async () => ({ count: 1 }) },
  logger: () => {},
};

const caller = (role: "super_admin" | "admin" | "user"): Caller => ({
  kind: "session",
  userId: "caller",
  role,
});

function deps(c: ClientBase, who: Caller): UsersRouteDeps {
  return {
    door,
    auth: async () => who,
    users: { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } },
  };
}

async function inRollback(fn: (c: ClientBase) => Promise<void>): Promise<void> {
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await fn(c);
    } finally {
      await c.query("ROLLBACK");
    }
  });
}

const email = (name: string) => `users-api-${name}-${Date.now()}-${Math.random()}@test.local`;

function json(body: unknown, method = "PATCH"): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

describe("GET /api/v1/users", () => {
  it("requires a session", async () => {
    await inRollback(async (c) => {
      const res = await usersRoute(deps(c, { kind: "anon" }))(new Request("http://local/api/v1/users"));
      expect(res.status).toBe(401);
    });
  });

  it("forbids a plain user", async () => {
    await inRollback(async (c) => {
      const res = await usersRoute(deps(c, caller("user")))(new Request("http://local/api/v1/users"));
      expect(res.status).toBe(403);
    });
  });

  it("lists users for an admin with q/limit/offset", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("list"), displayName: "List API" });

      const res = await usersRoute(deps(c, caller("admin")))(
        new Request("http://local/api/v1/users?q=List%20API&limit=10&offset=0"),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { users: { id: string }[]; total: number; limit: number };
      expect(body.users.some((user) => user.id === id)).toBe(true);
      expect(body.limit).toBe(10);
    });
  });
});

describe("GET/PATCH/DELETE /api/v1/users/{id}", () => {
  it("returns the user or 404", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("detail"), displayName: "Detail" });
      const route = userRoute(deps(c, caller("admin")));

      const ok = await route(new Request("http://local/api/v1/users/x"), id);
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { user: { display_name: string } };
      expect(body.user.display_name).toBe("Detail");

      const missing = await route(new Request("http://local/api/v1/users/x"), crypto.randomUUID());
      expect(missing.status).toBe(404);
    });
  });

  it("patches profile fields, rejects an empty body and admin→super_admin", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("patch") });
      const route = updateUserRoute(deps(c, caller("admin")));

      const ok = await route(
        new Request("http://local/api/v1/users/x", json({ display_name: "Patched" })),
        id,
      );
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as { user: { display_name: string } }).user.display_name).toBe(
        "Patched",
      );

      const empty = await route(new Request("http://local/api/v1/users/x", json({})), id);
      expect(empty.status).toBe(400);

      const escalate = await route(
        new Request("http://local/api/v1/users/x", json({ role: "super_admin" })),
        id,
      );
      expect(escalate.status).toBe(403);
    });
  });

  it("deactivates a user only for a super_admin", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("delete") });

      const forbidden = await deactivateUserRoute(deps(c, caller("admin")))(
        new Request("http://local/api/v1/users/x", { method: "DELETE" }),
        id,
      );
      expect(forbidden.status).toBe(403);

      const ok = await deactivateUserRoute(deps(c, caller("super_admin")))(
        new Request("http://local/api/v1/users/x", { method: "DELETE" }),
        id,
      );
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { user: { deactivated_at: string | null } };
      expect(body.user.deactivated_at).not.toBeNull();
    });
  });
});

describe("machine keys", () => {
  it("cannot change a role even with the scopes", async () => {
    await inRollback(async (c) => {
      const { id } = await createTestUser(c, { email: email("machine") });
      const machine: Caller = {
        kind: "service",
        keyId: "key-1",
        scopes: ["users:read", "users:write", "roles:assign"],
        roleCap: "super_admin",
      };

      const res = await updateUserRoute(deps(c, machine))(
        new Request("http://local/api/v1/users/x", json({ role: "admin" })),
        id,
      );

      expect(res.status).toBe(403);
    });
  });
});
