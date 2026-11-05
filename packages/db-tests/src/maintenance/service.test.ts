import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { query, withClient } from "../pg.js";
import { maintenanceStatus, runMaintenance, type MaintenanceDeps } from "@027apps/core/maintenance/service.js";
import type { Caller } from "@027apps/core/api/types.js";

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

function deps(c: ClientBase): MaintenanceDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return { db, withTransaction: (fn) => fn(db) };
}

const instanceKey: Caller = {
  kind: "service",
  keyId: "k1",
  scopes: ["maintenance:run"],
  roleCap: "super_admin",
};

describe("maintenance", () => {
  it("purges expired data with the core_cron role", async () => {
    await inRollback(async (c) => {
      await query(
        c,
        "insert into public.event_outbox (type, target, resource, state, published_at) values ('x', 'admins', '{}', 'published', now() - interval '40 days')",
      );
      await query(
        c,
        "insert into public.rate_limit_counters (key, window_start, expires_at) values ('x', now() - interval '2 days', now() - interval '1 day')",
      );
      await query(
        c,
        "insert into public.maintenance_runs (job, status, finished_at) values ('old.job', 'ok', now() - interval '100 days')",
      );

      const results = await runMaintenance(deps(c), instanceKey, [
        "outbox.purge",
        "invitations.purge",
        "rate_limit.purge",
        "devices.purge",
        "maintenance.purge",
      ]);
      expect(results.every((result) => result.status === "ok")).toBe(true);
      for (const job of ["outbox.purge", "rate_limit.purge", "maintenance.purge"]) {
        const summary = results.find((result) => result.job === job)?.summary as
          | { deleted: number }
          | undefined;
        expect(summary?.deleted).toBeGreaterThanOrEqual(1);
      }
    });
  });

  it("enforces the lease and the cooldown", async () => {
    await inRollback(async (c) => {
      const first = await runMaintenance(deps(c), instanceKey, ["rate_limit.purge"]);
      expect(first[0]!.status).toBe("ok");

      const second = await runMaintenance(deps(c), instanceKey, ["rate_limit.purge"]);
      expect(second[0]).toMatchObject({ status: "skipped", summary: { reason: "cooldown" } });
    });
  });

  it("reclaims a stale lease instead of blocking forever", async () => {
    await inRollback(async (c) => {
      await query(
        c,
        "insert into public.maintenance_runs (job, status, lease_until) values ('rate_limit.purge', 'running', now() - interval '1 minute')",
      );
      const results = await runMaintenance(deps(c), instanceKey, ["rate_limit.purge"]);
      expect(results[0]!.status).toBe("ok");
      const { rows } = await query(c, "select status from public.maintenance_runs where job = 'rate_limit.purge' and status = 'timeout'");
      expect(rows).toHaveLength(1);
    });
  });

  it("rejects unknown jobs and non-instance callers", async () => {
    await inRollback(async (c) => {
      await expect(runMaintenance(deps(c), instanceKey, ["not.a.job"])).rejects.toMatchObject({
        code: "validation_failed",
      });
      await expect(
        runMaintenance(deps(c), { kind: "session", userId: "u", role: "super_admin" }),
      ).rejects.toMatchObject({ code: "insufficient_scope" });
    });
  });

  it("fails outbox.publish cleanly when realtime is not configured and reports status", async () => {
    await inRollback(async (c) => {
      const results = await runMaintenance(deps(c), instanceKey, ["outbox.publish"]);
      expect(results[0]!.status).toBe("failed");
      const status = await maintenanceStatus(deps(c));
      expect(status.runs.length).toBeGreaterThan(0);
      expect(Array.isArray(status.outbox)).toBe(true);
    });
  });
});
