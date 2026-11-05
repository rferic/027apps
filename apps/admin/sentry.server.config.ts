import * as Sentry from "@sentry/nextjs";
import { initSentry, type SentrySdk } from "@027apps/core/sentry.js";

/**
 * Server-side Sentry config (SDK convention). The same initialization also runs
 * from `instrumentation.ts`; it is idempotent and only acts when `SENTRY_DSN`
 * exists. The client SDK is intentionally not enabled: the DSN stays on the
 * server so no browser event can carry request data.
 */
initSentry(
  {
    dsn: process.env.SENTRY_DSN ?? null,
    environment: process.env.NODE_ENV ?? "development",
  },
  Sentry as unknown as SentrySdk,
);
