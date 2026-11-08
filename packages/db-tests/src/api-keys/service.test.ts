import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  createApiKey,
  getApiKey,
  hashApiKeyToken,
  listApiKeys,
  resolveApiKey,
  revokeApiKey,
  type ApiKeysDeps,
} from "@027apps/core/api-keys/service.js";
import { deactivateUser } from "@027apps/core/users/service.js";
import { resolveCaller } from "@027apps/core/auth/caller.js";
import type { Caller } from "@027apps/core/api/types.js";

const PAGE = { limit: 100, offset: 0 };

const email = (name: string) => `key-${name}-${Date.now()}-${Math.random()}@test.local`;

const deps = (c: ClientBase): ApiKeysDeps => ({
  db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) },
});

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

async function session(
  c: ClientBase,
  role: "super_admin" | "admin" | "user",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("api keys service", () => {
  it("creates a service key and stores only its hash", async () => {
    await inRollback(async (c) => {
      const who = await session(c, "super_admin");
      const { api_key, secret } = await createApiKey(deps(c), who, {
        kind: "service",
        name: "MCP admin",
        scopes: ["users:read", "invitations:write"],
      });

      expect(secret.startsWith("027_svc_")).toBe(true);
      expect(api_key.kind).toBe("service");
      expect(api_key.role_cap).toBe("admin");
      expect(api_key.user_id).toBeNull();
      expect(api_key.prefix).toBe("027_svc_");
      expect(JSON.stringify(api_key)).not.toContain(secret);

      const { rows } = await query(c, "select key_hash from public.api_keys where id = $1", [
        api_key.id,
      ]);
      expect(rows[0]!.key_hash).toBe(hashApiKeyToken(secret));
      expect(String(rows[0]!.key_hash)).not.toContain("027_svc_");
    });
  });

  it("creates delegated keys for their own user and refuses service keys to non-super_admins", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      const user = await session(c, "user");

      const delegated = await createApiKey(deps(c), user, {
        kind: "delegated",
        name: "My tool",
        scopes: ["profile:read"],
      });
      expect(delegated.secret.startsWith("027_usr_")).toBe(true);
      expect(delegated.api_key.user_id).toBe(user.userId);
      expect(delegated.api_key.role_cap).toBeNull();

      await expect(
        createApiKey(deps(c), admin, {
          kind: "service",
          name: "Nope",
          scopes: ["users:read"],
        }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });

      await expect(
        createApiKey(deps(c), user, {
          kind: "delegated",
          name: "Bad",
          scopes: ["not a scope"],
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });

      await expect(
        createApiKey(deps(c), user, {
          kind: "delegated",
          name: "Past",
          scopes: ["profile:read"],
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        }),
      ).rejects.toMatchObject({ code: "validation_failed" });
    });
  });

  it("scopes listing by role: super_admin sees all, everyone else sees their own", async () => {
    await inRollback(async (c) => {
      // The local stack may hold keys from other runs; this test asserts the
      // global count, so it starts from a clean table inside the rollback.
      await query(c, "delete from public.api_keys");
      const superAdmin = await session(c, "super_admin");
      const admin = await session(c, "admin");
      const user = await session(c, "user");

      await createApiKey(deps(c), superAdmin, {
        kind: "service",
        name: "Service",
        scopes: ["users:read"],
      });
      await createApiKey(deps(c), admin, {
        kind: "delegated",
        name: "Admin tool",
        scopes: ["users:read"],
      });
      await createApiKey(deps(c), user, {
        kind: "delegated",
        name: "User tool",
        scopes: ["profile:read"],
      });

      expect((await listApiKeys(deps(c), superAdmin, PAGE)).api_keys).toHaveLength(3);
      expect((await listApiKeys(deps(c), admin, PAGE)).api_keys).toHaveLength(1);
      expect((await listApiKeys(deps(c), user, PAGE)).api_keys).toHaveLength(1);

      const serviceCaller: Caller = {
        kind: "service",
        keyId: "k1",
        scopes: ["api_keys:read"],
        roleCap: "super_admin",
      };
      await expect(listApiKeys(deps(c), serviceCaller, PAGE)).rejects.toMatchObject({
        code: "insufficient_scope",
      });
    });
  });

  it("resolves live, records last use and stops immediately after revocation or expiry", async () => {
    await inRollback(async (c) => {
      const who = await session(c, "user");
      const { api_key, secret } = await createApiKey(deps(c), who, {
        kind: "delegated",
        name: "Live",
        scopes: ["profile:read"],
      });

      const resolved = await resolveApiKey(deps(c), secret);
      expect(resolved).toMatchObject({
        id: api_key.id,
        kind: "delegated",
        userId: who.userId,
        scopes: ["profile:read"],
      });
      const { rows: used } = await query(c, "select last_used_at from public.api_keys where id = $1", [
        api_key.id,
      ]);
      expect(used[0]!.last_used_at).not.toBeNull();

      await revokeApiKey(deps(c), who, api_key.id);
      await expect(resolveApiKey(deps(c), secret)).resolves.toBeNull();

      const second = await createApiKey(deps(c), who, {
        kind: "delegated",
        name: "Expired",
        scopes: ["profile:read"],
      });
      await query(
        c,
        "update public.api_keys set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = $1",
        [
        second.api_key.id,
      ]);
      await expect(resolveApiKey(deps(c), second.secret)).resolves.toBeNull();
      await expect(resolveApiKey(deps(c), "027_usr_not-a-real-key")).resolves.toBeNull();
    });
  });

  it("hides other users' keys and lets a super_admin manage service keys", async () => {
    await inRollback(async (c) => {
      const superAdmin = await session(c, "super_admin");
      const owner = await session(c, "user");
      const other = await session(c, "admin");

      const delegated = await createApiKey(deps(c), owner, {
        kind: "delegated",
        name: "Owner",
        scopes: ["profile:read"],
      });
      const service = await createApiKey(deps(c), superAdmin, {
        kind: "service",
        name: "Service",
        scopes: ["users:read"],
        role_cap: "super_admin",
      });

      await expect(getApiKey(deps(c), other, delegated.api_key.id)).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(revokeApiKey(deps(c), other, delegated.api_key.id)).rejects.toMatchObject({
        code: "not_found",
      });

      expect((await getApiKey(deps(c), superAdmin, delegated.api_key.id)).name).toBe("Owner");
      await revokeApiKey(deps(c), superAdmin, service.api_key.id);
      expect((await getApiKey(deps(c), superAdmin, service.api_key.id)).revoked_at).not.toBeNull();
    });
  });

  it("does not let a delegated super_admin escalate into a service key", async () => {
    await inRollback(async (c) => {
      const owner = await session(c, "super_admin");
      const delegated: Caller = {
        kind: "delegated",
        keyId: "k1",
        scopes: ["api_keys:write"],
        roleCap: "super_admin",
        userId: owner.userId,
      };

      await expect(
        createApiKey(deps(c), delegated, {
          kind: "service",
          name: "Escalation",
          scopes: ["users:deactivate"],
          role_cap: "super_admin",
        }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });

  it("resolves a real service key through resolveCaller and stops after revocation", async () => {
    await inRollback(async (c) => {
      const who = await session(c, "super_admin");
      const { api_key, secret } = await createApiKey(deps(c), who, {
        kind: "service",
        name: "End to end",
        scopes: ["users:read"],
      });

      const port = { resolve: (token: string) => resolveApiKey(deps(c), token) };
      const request = () =>
        new Request("http://local/api/v1/users", {
          headers: { authorization: `Bearer ${secret}` },
        });
      const resolver = {
        supabase: {
          async getUser() {
            return { data: { user: null }, error: { message: "unused" } };
          },
        },
        profiles: {
          async getRole() {
            return "user" as const;
          },
          async isActive() {
            return true;
          },
        },
        apiKeys: port,
      };

      await expect(resolveCaller(request(), resolver)).resolves.toMatchObject({
        kind: "service",
        keyId: api_key.id,
        roleCap: "admin",
        scopes: ["users:read"],
      });

      await revokeApiKey(deps(c), who, api_key.id);
      await expect(resolveCaller(request(), resolver)).rejects.toMatchObject({
        code: "unauthorized",
      });
    });
  });

  it("revokes delegated keys when the user is deactivated", async () => {
    await inRollback(async (c) => {
      const superAdmin = await session(c, "super_admin");
      const victim = await session(c, "user");
      const { api_key } = await createApiKey(deps(c), victim, {
        kind: "delegated",
        name: "Victim",
        scopes: ["profile:read"],
      });
      await query(c, "insert into public.devices (user_id, platform) values ($1, 'android')", [
        victim.userId,
      ]);

      await deactivateUser(
        { db: { query: (sql: string, params: unknown[] = []) => query(c, sql, params) } },
        superAdmin,
        victim.userId,
      );

      const { rows: key } = await query(c, "select revoked_at from public.api_keys where id = $1", [
        api_key.id,
      ]);
      const { rows: device } = await query(c, "select revoked_at from public.devices where user_id = $1", [
        victim.userId,
      ]);
      expect(key[0]!.revoked_at).not.toBeNull();
      expect(device[0]!.revoked_at).not.toBeNull();
    });
  });
});
