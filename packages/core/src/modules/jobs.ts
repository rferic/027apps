import { DomainError } from "../errors";
import { resetSessionSettings } from "./session-settings";
import type { QueryClient } from "../api/rate-limit-storage";
import { isDueAt } from "./cron";
import type { ModulesDeps } from "./service";

type Job = { key: string; schedule: string; fn: string; timeout_seconds: number };

export type JobRunResult = {
  module_key: string;
  job_key: string;
  status: "ok" | "error" | "skipped";
  duration_ms?: number;
  error?: string;
};

export type DispatchResult = { runs: JobRunResult[]; executed: number; failed: number };

const IDENT = /^[a-z][a-z0-9_]{0,62}$/;

function schemaFor(key: string): string {
  return `module_${key.replace(/-/g, "_")}`;
}

/** Minute precision: the claim key for one scheduled execution. */
function scheduledFor(now: Date): Date {
  const minute = new Date(now);
  minute.setUTCSeconds(0, 0);
  return minute;
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 500);
}

/**
 * Claims one execution and runs it. The row in `module_job_runs` is the claim
 * (unique per module/job/timestamp), so a second dispatcher call in the same
 * minute gets `skipped`. The function runs inside a real transaction: that is
 * what makes `SET LOCAL statement_timeout` and `search_path` survive to the
 * call. A failure is recorded and returned, never thrown to the batch.
 */
async function executeJob(
  deps: ModulesDeps,
  moduleKey: string,
  job: Job,
  claimAt: Date,
): Promise<JobRunResult> {
  if (!deps.withTransaction) throw new DomainError("internal", "jobs need a transaction runner");
  if (!IDENT.test(job.fn)) {
    return { module_key: moduleKey, job_key: job.key, status: "error", error: "invalid function" };
  }

  const { rows: claim } = await deps.db.query(
    `insert into public.module_job_runs (module_key, job_key, scheduled_for)
     values ($1, $2, $3)
     on conflict (module_key, job_key, scheduled_for) do nothing
     returning id`,
    [moduleKey, job.key, claimAt.toISOString()],
  );
  const runId = claim[0]?.id;
  if (!runId) return { module_key: moduleKey, job_key: job.key, status: "skipped" };

  const started = Date.now();
  try {
    await deps.withTransaction(async (db: QueryClient) => {
      try {
        await db.query(`set local statement_timeout = ${Number(job.timeout_seconds) * 1000}`);
        // Unqualified tables resolve against the module schema, as in migrations.
        await db.query(`set local search_path to ${quote(schemaFor(moduleKey))}`);
        await db.query(`select ${quote(job.fn)}()`);
      } finally {
        await resetSessionSettings(db);
      }
    });
    const duration = Date.now() - started;
    await deps.db.query(
      `update public.module_job_runs
          set status = 'ok', finished_at = now(), duration_ms = $2
        where id = $1`,
      [runId, duration],
    );
    return { module_key: moduleKey, job_key: job.key, status: "ok", duration_ms: duration };
  } catch (error) {
    const duration = Date.now() - started;
    await deps.db.query(
      `update public.module_job_runs
          set status = 'error', finished_at = now(), duration_ms = $2, error = $3
        where id = $1`,
      [runId, duration, message(error)],
    );
    return {
      module_key: moduleKey,
      job_key: job.key,
      status: "error",
      duration_ms: duration,
      error: message(error),
    };
  }
}

/** Runs every job that is due in this minute for active modules. */
export async function runDueModuleJobs(
  deps: ModulesDeps,
  now: Date = new Date(),
): Promise<DispatchResult> {
  const at = scheduledFor(now);
  const { rows } = await deps.db.query(
    `select key, jobs from public.module_registry
      where state = 'active' and jsonb_array_length(jobs) > 0`,
  );

  const runs: JobRunResult[] = [];
  let executed = 0;
  let failed = 0;

  for (const row of rows) {
    const moduleKey = String(row.key);
    for (const job of (row.jobs as Job[] | null) ?? []) {
      if (!isDueAt(job.schedule, at)) continue;
      const result = await executeJob(deps, moduleKey, job, at);
      runs.push(result);
      if (result.status === "ok") executed += 1;
      else if (result.status === "error") failed += 1;
    }
  }

  return { runs, executed, failed };
}

/**
 * Manual run from the panel. The claim uses the exact timestamp, not the
 * minute, so a manual click never steals the scheduled slot (and vice versa).
 */
export async function runModuleJobNow(
  deps: ModulesDeps,
  key: string,
  jobKey: string,
  now: Date = new Date(),
): Promise<JobRunResult> {
  const { rows } = await deps.db.query(
    "select state, jobs from public.module_registry where key = $1",
    [key],
  );
  const row = rows[0];
  if (!row) throw new DomainError("not_found");
  if (row.state !== "active") {
    throw new DomainError("conflict", "module is not active", { code: "module_inactive" });
  }
  const job = ((row.jobs as Job[] | null) ?? []).find((candidate) => candidate.key === jobKey);
  if (!job) throw new DomainError("not_found");
  return executeJob(deps, key, job, now);
}

/** Job history for the panel, newest first. */
export async function listModuleJobRuns(
  deps: ModulesDeps,
  moduleKey: string,
  limit = 20,
): Promise<JobRunResult[]> {
  const { rows } = await deps.db.query(
    `select job_key, status, duration_ms, error
       from public.module_job_runs
      where module_key = $1
      order by started_at desc
      limit $2`,
    [moduleKey, limit],
  );
  return rows.map((row) => ({
    module_key: moduleKey,
    job_key: String(row.job_key),
    status: row.status as JobRunResult["status"],
    ...(row.duration_ms === null ? {} : { duration_ms: Number(row.duration_ms) }),
    ...(row.error === null ? {} : { error: String(row.error) }),
  }));
}

function quote(identifier: string): string {
  return `"${identifier}"`;
}
