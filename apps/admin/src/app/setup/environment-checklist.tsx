import type { EnvironmentReport } from "@027apps/core/setup/environment.js";

/** Status dot + label for one environment check. */
const TONE = {
  ok: "text-success",
  missing: "text-muted-foreground",
  failed: "text-destructive",
} as const;

const SYMBOL = { ok: "✓", missing: "•", failed: "✕" } as const;

/**
 * Setup step 1: what the wizard cannot write (hosting env and the Supabase
 * project) is guided and verified here before creating the admin.
 */
export function EnvironmentChecklist({ report }: { report: EnvironmentReport }) {
  return (
    <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">Step 1 · Environment</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These settings live in your hosting environment and the Supabase project, not in the app.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {report.checks.map((check) => (
          <li key={check.key} className="flex gap-2 text-xs">
            <span aria-hidden className={TONE[check.status]}>
              {SYMBOL[check.status]}
            </span>
            <span>
              <span className="font-medium capitalize">{check.key.replace("_", " ")}</span>{" "}
              <span className={TONE[check.status]}>{check.status}</span>
              <span className="block text-muted-foreground">{check.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
