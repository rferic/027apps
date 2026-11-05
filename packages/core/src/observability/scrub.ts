/**
 * Sentry event scrubber (fail-closed). Sentry is for 5xx only: 4xx and the
 * operational /health 503 are not errors. Request data, IP, email, breadcrumbs
 * and raw `extra` are removed before sending. If scrubbing throws, the event is
 * dropped: better to lose an event than to leak data.
 */
export interface SentryEventLike {
  request?: unknown;
  user?: { ip?: string; email?: string; [key: string]: unknown };
  breadcrumbs?: unknown;
  extra?: unknown;
  tags?: Record<string, string>;
  [key: string]: unknown;
}

export function scrubEvent(event: SentryEventLike | null): SentryEventLike | null {
  if (!event) return null;
  try {
    const status = Number(event.tags?.status_code ?? 0);
    if (status >= 400 && status < 500) return null;

    const url = typeof event.tags?.url === "string" ? event.tags.url : "";
    if (url.includes("/health") && status === 503) return null;

    const cleaned: SentryEventLike = { ...event };
    delete cleaned.request;
    delete cleaned.breadcrumbs;
    delete cleaned.extra;

    if (cleaned.user) {
      const { ip, email, ...rest } = cleaned.user;
      void ip;
      void email;
      cleaned.user = rest;
    }
    return cleaned;
  } catch {
    return null;
  }
}
