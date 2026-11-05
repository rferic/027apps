import { DomainError } from "../errors";
import type { Caller, JsonValue } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";
import { publishPending, type RealtimeDeps } from "../realtime/service";

/**
 * Maintenance jobs (task-07/§4.3): a closed allowlist, an atomic lease per job
 * and a one-minute cooldown. Purges run as `core_cron`, a role with DELETE only
 * on the tables maintenance may clean.
 */
export const MAINTENANCE_JOBS = [
  "outbox.publish",
  "outbox.purge",
  "invitations.purge",
  "rate_limit.purge",
  "devices.purge",
  "maintenance.purge",
] as const;

export type MaintenanceJob = (typeof MAINTENANCE_JOBS)[number];

export interface MaintenanceDeps {
  db: QueryClient;
  withTransaction?: <T>(fn: (db: QueryClient) => Promise<T>) => Promise<T>;
  realtime?: RealtimeDeps;
}

export type MaintenanceResult = {
  job: string;
  status: "ok" | "failed" | "skipped" | "timeout";
  summary?: JsonValue;
};

const COOLDOWN_MS = 60_000;

function canRun(caller: Caller): boolean {
  // The endpoint is meant for an instance key, not a delegated user key.
  return caller.kind === "service" && caller.roleCap === "super_admin";
}

async function acquireLease(db: QueryClient, job: string): Promise<string | null> {
  // A crashed runner must not leave a permanent lease behind.
  await db.query(
    `update public.maintenance_runs
        set status = 'timeout', finished_at = null, lease_until = null
      where job = $1 and status = 'running' and lease_until < now()`,
    [job],
  );
  const { rows } = await db.query(
    `insert into public.maintenance_runs (job, status, lease_until)
     values ($1, 'running', now() + interval '5 minutes')
     on conflict (job) where status = 'running' do nothing
     returning run_id`,
    [job],
  );
  return rows[0] ? String(rows[0].run_id) : null;
}

async function cooledDown(db: QueryClient, job: string): Promise<boolean> {
  const { rows } = await db.query(
    `select finished_at from public.maintenance_runs
      where job = $1 and finished_at is not null
      order by finished_at desc limit 1`,
    [job],
  );
  const finished = rows[0]?.finished_at;
  if (!finished) return false;
  return Date.now() - new Date(String(finished)).getTime() < COOLDOWN_MS;
}

const PURGES: Record<string, string> = {
  "outbox.purge": `delete from public.event_outbox
    where (state = 'published' and published_at < now() - interval '30 days')
       or (state = 'failed' and failed_at < now() - interval '90 days') returning 1`,
  "invitations.purge": `delete from public.invitations
    where (used_at is not null or revoked_at is not null or expires_at < now())
      and created_at < now() - interval '30 days' returning 1`,
  "rate_limit.purge": "delete from public.rate_limit_counters where expires_at < now() returning 1",
  "devices.purge": `delete from public.devices
    where revoked_at is not null and revoked_at < now() - interval '90 days' returning 1`,
  "maintenance.purge": `delete from public.maintenance_runs where finished_at < now() - interval '90 days' returning 1`,
};

async function runJob(deps: MaintenanceDeps, job: string): Promise<Record<string, unknown>> {
  if (job === "outbox.publish") {
    if (!deps.realtime) throw new Error("realtime transport is not configured");
    const result = await publishPending(deps.realtime);
    return { processed: result.published + result.retried, published: result.published, failed: result.failed };
  }

  const sql = PURGES[job];
  if (!sql) throw new DomainError("validation_failed", "unknown maintenance job");
  const run = deps.withTransaction ?? (<T>(fn: (db: QueryClient) => Promise<T>) => fn(deps.db));
  return run(async (db) => {
    await db.query("set local role core_cron");
    try {
      const { rows } = await db.query(sql);
      return { deleted: rows.length };
    } finally {
      await db.query("reset role");
    }
  });
}

async function finishRun(
  db: QueryClient,
  runId: string,
  job: string,
  status: "ok" | "failed",
  summary: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `update public.maintenance_runs
        set status = $1, summary = $2, finished_at = now(), lease_until = null
      where run_id = $3 and job = $4`,
    [status, JSON.stringify(summary), runId, job],
  );
}

export async function runMaintenance(
  deps: MaintenanceDeps,
  caller: Caller,
  requested?: string[],
): Promise<MaintenanceResult[]> {
  if (!canRun(caller)) throw new DomainError("insufficient_scope");
  const jobs = requested ?? [...MAINTENANCE_JOBS];
  for (const job of jobs) {
    if (!MAINTENANCE_JOBS.includes(job as MaintenanceJob)) {
      throw new DomainError("validation_failed", `unknown maintenance job: ${job}`);
    }
  }

  const results: MaintenanceResult[] = [];
  for (const job of jobs) {
    const runId = await acquireLease(deps.db, job);
    if (!runId) {
      results.push({ job, status: "skipped", summary: { reason: "lease" } });
      continue;
    }
    if (await cooledDown(deps.db, job)) {
      await finishRun(deps.db, runId, job, "ok", { reason: "cooldown" });
      results.push({ job, status: "skipped", summary: { reason: "cooldown" } });
      continue;
    }

    try {
      const summary = await runJob(deps, job);
      await finishRun(deps.db, runId, job, "ok", summary);
      results.push({ job, status: "ok", summary: summary as JsonValue });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await finishRun(deps.db, runId, job, "failed", { error: message.slice(0, 200) });
      results.push({ job, status: "failed", summary: { error: message.slice(0, 200) } });
    }
  }
  return results;
}

export async function maintenanceStatus(
  deps: MaintenanceDeps,
): Promise<{ runs: JsonValue[]; outbox: JsonValue[] }> {
  const { rows: runs } = await deps.db.query(
    `select distinct on (job) job, status, summary, started_at, finished_at
       from public.maintenance_runs
      order by job, started_at desc`,
  );
  const { rows: outbox } = await deps.db.query(
    "select state, count(*)::int as count from public.event_outbox group by state",
  );
  return { runs: runs as JsonValue[], outbox: outbox as JsonValue[] };
}
