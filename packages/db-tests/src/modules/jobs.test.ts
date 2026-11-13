import { describe, expect, it } from "vitest";
import type { ClientBase } from "pg";
import { createTestUser, query, withClient } from "../pg.js";
import {
  activateModule,
  deactivateModule,
  installModule,
  type ModulesDeps,
} from "@027apps/core/modules/service.js";
import { runDueModuleJobs } from "@027apps/core/modules/jobs.js";
import { sha256 } from "@027apps/core/modules/manifest.js";
import type { Caller } from "@027apps/core/api/types.js";

const UP = `
create table job_log (id bigserial primary key, ran_at timestamptz not null default now());
create function job_ping() returns void
language sql
as $$ insert into job_log default values; $$;
create function job_boom() returns void
language plpgsql
as $$ begin raise exception 'boom'; end $$;
`;
const DOWN = "drop table if exists job_log cascade;";

const email = (name: string) => `job-${name}-${Date.now()}-${Math.random()}@test.local`;

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

function deps(c: ClientBase): ModulesDeps {
  const db = { query: (sql: string, params: unknown[] = []) => query(c, sql, params) };
  return {
    db,
    withTransaction: async <T,>(fn: (tx: typeof db) => Promise<T>): Promise<T> => {
      await c.query("savepoint module_op");
      try {
        const result = await fn(db);
        await c.query("release savepoint module_op");
        return result;
      } catch (error) {
        await c.query("rollback to savepoint module_op");
        throw error;
      }
    },
    moduleRoot: (key) => `/modules/${key}`,
    readFile: async (path) =>
      path.endsWith(".svg") ? '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor"></svg>' : "# Module",
  };
}

function manifest(key: string, job: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    name: key,
    branding: { description: key, icon: "assets/icon.svg", color: "teal" },
    version: "1.0.0",
    contract: 1,
    is_public: false,
    migrations: [
      { version: "1.0.0", up: UP, down: DOWN, digest: sha256(UP), down_digest: sha256(DOWN) },
    ],
    settings: [],
    i18n: ["en"],
    scopes: [],
    mcp_tools: [],
    channels: [],
    events: [],
    admin_pages: [],
    dashboard_widgets: [],
    jobs: [{ key: job, schedule: "* * * * *", fn: job === "ping" ? "job_ping" : "job_boom", timeout_seconds: 5 }],
    docs: { readme: "README.md" },
    ...overrides,
  };
}

async function session(
  c: ClientBase,
  role: "super_admin" | "admin",
): Promise<Caller & { kind: "session" }> {
  const { id } = await createTestUser(c, { email: email(role), role });
  return { kind: "session", userId: id, role };
}

describe("module jobs", () => {
  it("runs a due job once per minute and not at all when disabled", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest("jobs-module", "ping"));
      await activateModule(deps(c), admin, "jobs-module");

      const first = await runDueModuleJobs(deps(c), new Date("2026-11-13T10:05:30Z"));
      const mine = first.runs.filter((run) => run.module_key === "jobs-module");
      expect(mine).toEqual([
        { module_key: "jobs-module", job_key: "ping", status: "ok", duration_ms: expect.any(Number) },
      ]);

      // Same minute: the claim is taken, nothing runs twice.
      const again = await runDueModuleJobs(deps(c), new Date("2026-11-13T10:05:50Z"));
      expect(again.runs.filter((run) => run.module_key === "jobs-module")).toEqual([
        { module_key: "jobs-module", job_key: "ping", status: "skipped" },
      ]);

      const { rows: count } = await query(c, "select count(*)::int as n from module_jobs_module.job_log");
      expect(count[0].n).toBe(1);

      // Next minute runs again.
      await runDueModuleJobs(deps(c), new Date("2026-11-13T10:06:00Z"));
      const { rows: after } = await query(c, "select count(*)::int as n from module_jobs_module.job_log");
      expect(after[0].n).toBe(2);

      // A deactivated module is not dispatched.
      await deactivateModule(deps(c), admin, "jobs-module");
      await runDueModuleJobs(deps(c), new Date("2026-11-13T10:07:00Z"));
      const { rows: disabled } = await query(c, "select count(*)::int as n from module_jobs_module.job_log");
      expect(disabled[0].n).toBe(2);
    });
  });

  it("records a failure without aborting the batch", async () => {
    await inRollback(async (c) => {
      const admin = await session(c, "admin");
      await installModule(deps(c), admin, manifest("boom-module", "boom"));
      await activateModule(deps(c), admin, "boom-module");

      const result = await runDueModuleJobs(deps(c), new Date("2026-11-13T10:05:00Z"));
      const mine = result.runs.filter((run) => run.module_key === "boom-module");
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ status: "error", job_key: "boom" });
      expect(mine[0]?.error).toContain("boom");

      const { rows } = await query(
        c,
        "select status, error from public.module_job_runs where module_key = 'boom-module'",
      );
      expect(rows[0].status).toBe("error");
      expect(String(rows[0].error)).toContain("boom");
    });
  });
});
