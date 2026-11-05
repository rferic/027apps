/**
 * Sentry event scrubber (fail-closed). Sentry is for 5xx only: 4xx and the
 * operational /health 503 are not errors. Request data, IP, email, breadcrumbs
 * and raw `extra` are removed before sending. If scrubbing throws, the event is
 * dropped: better to lose an event than to leak data.
 */
export interface SentryEventLike {
  request?: { url?: string; [key: string]: unknown };
  user?: { id?: string; ip?: string; email?: string; [key: string]: unknown };
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: { response?: { status_code?: number }; [key: string]: unknown };
  exception?: {
    values?: Array<{ stacktrace?: { frames?: Array<Record<string, unknown>> } }>;
  };
  tags?: Record<string, string>;
  [key: string]: unknown;
}

/** Frames kept per exception (last N, the ones closest to the failure). */
const MAX_FRAMES = 20;
/** Source snippets that may contain secrets; removed from every frame. */
const FRAME_SOURCE_KEYS = ["context_line", "pre_context", "post_context"];

/** Keeps the last `MAX_FRAMES` frames and drops source snippets. */
function trimStack(exception: SentryEventLike["exception"]): SentryEventLike["exception"] {
  if (!exception?.values) return exception;
  return {
    ...exception,
    values: exception.values.map((value) => {
      const frames = value.stacktrace?.frames;
      if (!Array.isArray(frames)) return value;
      return {
        ...value,
        stacktrace: {
          ...value.stacktrace,
          frames: frames.slice(-MAX_FRAMES).map((frame) => {
            const copy = { ...frame };
            for (const key of FRAME_SOURCE_KEYS) delete copy[key];
            return copy;
          }),
        },
      };
    }),
  };
}

export function scrubEvent(event: SentryEventLike | null): SentryEventLike | null {
  if (!event) return null;
  try {
    // @sentry/nextjs exposes the HTTP status under contexts.response.
    const status = Number(event.contexts?.response?.status_code ?? event.tags?.status_code ?? 0);
    if (status >= 400 && status < 500) return null;

    const url =
      (typeof event.tags?.url === "string" ? event.tags.url : undefined) ??
      (typeof event.request?.url === "string" ? event.request.url : "");
    if (url.includes("/health") && status === 503) return null;

    const cleaned: SentryEventLike = { ...event };
    delete cleaned.request;
    delete cleaned.breadcrumbs;
    delete cleaned.extra;
    // Keep only the opaque user id: an allowlist, not a blocklist.
    cleaned.user = cleaned.user?.id ? { id: cleaned.user.id } : undefined;
    if (!cleaned.user) delete cleaned.user;
    cleaned.exception = trimStack(cleaned.exception);
    // Device/OS/runtime contexts add no value to a 5xx and can carry data.
    delete cleaned.contexts;
    return cleaned;
  } catch {
    return null;
  }
}
