import type { CheckStatus, EnvironmentCheck, EnvironmentReport } from "@027apps/core/setup/environment.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

/** Status dot + label for one environment check. */
const TONE = {
  ok: "text-success",
  missing: "text-muted-foreground",
  failed: "text-destructive",
} as const;

const SYMBOL = { ok: "✓", missing: "•", failed: "✕" } as const;

function checkLabel(key: EnvironmentCheck["key"], messages: TranslationMap): string {
  switch (key) {
    case "database":
      return t("Database", messages);
    case "migrations":
      return t("Migrations", messages);
    case "encryption_key":
      return t("Encryption key", messages);
    case "sentry":
      return t("Sentry", messages);
  }
}

function statusLabel(status: CheckStatus, messages: TranslationMap): string {
  switch (status) {
    case "ok":
      return t("ok", messages);
    case "missing":
      return t("missing", messages);
    case "failed":
      return t("failed", messages);
  }
}

/**
 * Setup step 1: what the wizard cannot write (hosting env and the Supabase
 * project) is guided and verified here before creating the admin.
 */
export function EnvironmentChecklist({
  report,
  messages,
}: {
  report: EnvironmentReport;
  messages: TranslationMap;
}) {
  return (
    <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("Step 1 · Environment", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t(
          "These settings live in your hosting environment and the Supabase project, not in the app.",
          messages,
        )}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {report.checks.map((check) => (
          <li key={check.key} className="flex gap-2 text-xs">
            <span aria-hidden className={TONE[check.status]}>
              {SYMBOL[check.status]}
            </span>
            <span>
              <span className="font-medium capitalize">{checkLabel(check.key, messages)}</span>{" "}
              <span className={TONE[check.status]}>{statusLabel(check.status, messages)}</span>
              <span className="block text-muted-foreground">{t(check.hint, messages)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
