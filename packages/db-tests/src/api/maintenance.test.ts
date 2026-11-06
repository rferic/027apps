import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { query, withClient } from "../pg.js";
import {
  maintenanceRunRoute,
  maintenanceStatusRoute,
  type MaintenanceRouteDeps,
} from "@027apps/core/maintenance/api.js";
import type { Caller, DoorDeps } from "@027apps/core/api/types.js";

function deps(c: ClientBase, who: Caller): MaintenanceRouteDeps {
  const door: DoorDeps = {
    rateLimitStorage: { increment: async () => ({ count: 1 }) },
    logger: () => {},
  };
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return { door, auth: async () => who, maintenance: { db, withTransaction: (fn) => fn(db) } };
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

const instanceKey: Caller = {
  kind: "service",
  keyId: "k1",
  scopes: ["maintenance:run"],
  roleCap: "super_admin",
};

describe("maintenance API", () => {
  it("requires an instance key and rejects delegated callers", async () => {
    await inRollback(async (c) => {
      const anon = await maintenanceRunRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/maintenance/run", { method: "POST" }),
      );
      expect(anon.status).toBe(401);

      const delegated = await maintenanceRunRoute(deps(c, {
        kind: "delegated",
        keyId: "k2",
        scopes: ["maintenance:run"],
        roleCap: "super_admin",
        userId: "u1",
      }))(
        new Request("http://local/api/v1/maintenance/run", { method: "POST" }),
      );
      expect(delegated.status).toBe(403);
    });
  });

  it("runs allowed jobs and rejects unknown ones", async () => {
    await inRollback(async (c) => {
      const ok = await maintenanceRunRoute(deps(c, instanceKey))(
        new Request("http://local/api/v1/maintenance/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobs: ["rate_limit.purge"] }),
        }),
      );
      expect(ok.status).toBe(200);

      const bad = await maintenanceRunRoute(deps(c, instanceKey))(
        new Request("http://local/api/v1/maintenance/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobs: ["not.a.job"] }),
        }),
      );
      expect(bad.status).toBe(400);
    });
  });

  it("exposes status only to the super_admin session", async () => {
    await inRollback(async (c) => {
      const anon = await maintenanceStatusRoute(deps(c, { kind: "anon" }))(
        new Request("http://local/api/v1/maintenance/status"),
      );
      expect(anon.status).toBe(403);

      const plain = await maintenanceStatusRoute(deps(c, { kind: "session", userId: "u1", role: "user" }))(
        new Request("http://local/api/v1/maintenance/status"),
      );
      expect(plain.status).toBe(403);

      const superAdmin = await maintenanceStatusRoute(deps(c, {
        kind: "session",
        userId: "u2",
        role: "super_admin",
      }))(new Request("http://local/api/v1/maintenance/status"));
      expect(superAdmin.status).toBe(200);
    });
  });
});
