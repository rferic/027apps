import { initSentry, type SentrySdk } from "@027apps/core/sentry.js";

/**
 * Next.js instrumentation hook: initializes Sentry when `SENTRY_DSN` is set.
 * The DSN is server-only (no `NEXT_PUBLIC_`), PII is disabled and every event
 * goes through the fail-closed scrubber. Without a DSN nothing is initialized.
 */
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN ?? null;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  initSentry(
    { dsn, environment: process.env.NODE_ENV ?? "development" },
    Sentry as unknown as SentrySdk,
  );
}
