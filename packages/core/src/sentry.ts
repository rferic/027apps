import { scrubEvent, type SentryEventLike } from "./observability/scrub";

export interface SentrySdk {
  init(options: Record<string, unknown>): void;
}

/**
 * Initializes Sentry only when a DSN is configured. PII is disabled at the SDK
 * level and every event goes through `scrubEvent` (fail-closed). The SDK is
 * injected so core stays framework-agnostic; the admin passes `@sentry/nextjs`.
 */
export function initSentry(
  options: { dsn: string | null; environment: string },
  sdk: SentrySdk,
): void {
  if (!options.dsn) return;
  sdk.init({
    dsn: options.dsn,
    environment: options.environment,
    sendDefaultPii: false,
    beforeSend: (event: SentryEventLike) => scrubEvent(event),
  });
}
