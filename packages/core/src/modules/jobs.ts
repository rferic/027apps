import { DomainError } from "../errors";
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

/** Minute precision: the claim key for one execution. */
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
 * Runs every job that is due in this minute for active modules. The row in
 * `module_job_runs` is claimed first (unique per module/job/minute), so a
 * second dispatcher call in the same minute skips it. A job failure is recorded
 * and never aborts the batch; the function runs with the module's timeout.
 */
export async function runDueModuleJobs(
  deps: ModulesDeps,
  now: Date = new Date(),
): Promise<DispatchResult> {
  if (!deps.withTransaction) throw new DomainError("internal", "jobs need a transaction runner");
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
    const jobs = (row.jobs as Job[] | null) ?? [];
    for (const job of jobs) {
      if (!isDueAt(job.schedule, at)) continue;
      if (!IDENT.test(job.fn)) {
        runs.push({ module_key: moduleKey, job_key: job.key, status: "error", error: "invalid function" });
        failed += 1;
        continue;
      }

      const { rows: claim } = await deps.db.query(
        `insert into public.module_job_runs (module_key, job_key, scheduled_for)
         values ($1, $2, $3)
         on conflict (module_key, job_key, scheduled_for) do nothing
         returning id`,
        [moduleKey, job.key, at.toISOString()],
      );
      const runId = claim[0]?.id;
      if (!runId) {
        runs.push({ module_key: moduleKey, job_key: job.key, status: "skipped" });
        continue;
      }

      const started = Date.now();
      try {
        await deps.withTransaction(async (db: QueryClient) => {
          await db.query(`set local statement_timeout = ${Number(job.timeout_seconds) * 1000}`);
          // The function resolves unqualified tables against its own schema,
          // exactly like the migrations did when it was created.
          await db.query(`set local search_path to ${quote(schemaFor(moduleKey))}`);
          await db.query(`select ${quote(job.fn)}()`);
        });
        const duration = Date.now() - started;
        await deps.db.query(
          `update public.module_job_runs
              set status = 'ok', finished_at = now(), duration_ms = $2
            where id = $1`,
          [runId, duration],
        );
        runs.push({ module_key: moduleKey, job_key: job.key, status: "ok", duration_ms: duration });
        executed += 1;
      } catch (error) {
        const duration = Date.now() - started;
        await deps.db.query(
          `update public.module_job_runs
              set status = 'error', finished_at = now(), duration_ms = $2, error = $3
            where id = $1`,
          [runId, duration, message(error)],
        );
        runs.push({
          module_key: moduleKey,
          job_key: job.key,
          status: "error",
          duration_ms: duration,
          error: message(error),
        });
        failed += 1;
      }
    }
  }

  return { runs, executed, failed };
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
