import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  apiKeyRoute,
  apiKeysRoute,
  createApiKeyRoute,
  revokeApiKeyRoute,
  type ApiKeysRouteDeps,
} from "@027apps/core/api-keys/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

const email = (name: string) => `key-api-${name}-${Date.now()}-${Math.random()}@test.local`;

function deps(c: ClientBase, who: Caller): ApiKeysRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: () => {},
  };
  return {
    door,
    auth: async () => who,
    apiKeys: { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } },
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

function post(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function caller(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("api-keys API", () => {
  it("requires a session", async () => {
    await inRollback(async (c) => {
      const res = await apiKeysRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/api-keys"),
      );
      expect(res.status).toBe(401);
    });
  });

  it("creates a delegated key, returns the secret once and never lists it", async () => {
    await inRollback(async (c) => {
      const who = await caller(c, "user");
      const route = deps(c, who);

      const created = await createApiKeyRoute(route)(
        new Request(
          "http://local/api/v1/api-keys",
          post({ kind: "delegated", name: "My tool", scopes: ["profile:read"] }),
        ),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as {
        api_key: { id: string; prefix: string };
        secret: string;
      };
      expect(body.secret.startsWith("027_usr_")).toBe(true);
      expect(body.api_key.prefix).toBe("027_usr_");

      const listed = await apiKeysRoute(route)(new Request("http://local/api/v1/api-keys"));
      const listBody = (await listed.json()) as { api_keys: Record<string, unknown>[] };
      expect(listBody.api_keys).toHaveLength(1);
      expect(listBody.api_keys[0]).not.toHaveProperty("secret");
      expect(listBody.api_keys[0]).not.toHaveProperty("key_hash");

      const detail = await apiKeyRoute(route)(
        new Request(`http://local/api/v1/api-keys/${body.api_key.id}`),
        body.api_key.id,
      );
      expect(detail.status).toBe(200);
      expect(await detail.text()).not.toContain(body.secret);

      const revoked = await revokeApiKeyRoute(route)(
        new Request(`http://local/api/v1/api-keys/${body.api_key.id}`, { method: "DELETE" }),
        body.api_key.id,
      );
      expect(revoked.status).toBe(204);
      const again = await revokeApiKeyRoute(route)(
        new Request(`http://local/api/v1/api-keys/${body.api_key.id}`, { method: "DELETE" }),
        body.api_key.id,
      );
      expect(again.status).toBe(204);
    });
  });

  it("only a super_admin creates service keys", async () => {
    await inRollback(async (c) => {
      const admin = await caller(c, "admin");
      const forbidden = await createApiKeyRoute(deps(c, admin))(
        new Request(
          "http://local/api/v1/api-keys",
          post({ kind: "service", name: "Svc", scopes: ["users:read"] }),
        ),
      );
      expect(forbidden.status).toBe(403);

      const superAdmin = await caller(c, "super_admin");
      const created = await createApiKeyRoute(deps(c, superAdmin))(
        new Request(
          "http://local/api/v1/api-keys",
          post({ kind: "service", name: "Svc", scopes: ["users:read"], role_cap: "super_admin" }),
        ),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as { secret: string; api_key: { role_cap: string } };
      expect(body.secret.startsWith("027_svc_")).toBe(true);
      expect(body.api_key.role_cap).toBe("super_admin");
    });
  });

  it("rejects a malformed id with 400", async () => {
    await inRollback(async (c) => {
      const who = await caller(c, "user");
      const res = await apiKeyRoute(deps(c, who))(
        new Request("http://local/api/v1/api-keys/not-a-uuid"),
        "not-a-uuid",
      );
      expect(res.status).toBe(400);
    });
  });
});
