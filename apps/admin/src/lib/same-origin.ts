/**
 * Cross-site request forgery guard for the cookie-authenticated API.
 *
 * `/api/v1` accepts either an `Authorization: Bearer` token (API keys, mobile,
 * the panel's own in-process calls) or the browser session cookie. Browsers
 * attach cookies to cross-site requests, so a state-changing request that
 * relies on the session cookie must also prove it comes from the panel origin.
 * Bearer-only calls are unaffected: an attacker cannot set that header.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Minimal request surface: the proxy passes a `NextRequest`, tests a literal. */
export interface OriginCheckRequest {
  method: string;
  headers: { get(name: string): string | null };
}

/** Supabase names its cookies `sb-<ref>-auth-token` (possibly chunked). */
function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((pair) => pair.trim().startsWith("sb-"));
}

/** First host when a proxy appends the upstream host (`host, internal:3003`). */
function requestHost(headers: OriginCheckRequest["headers"]): string | null {
  const forwarded = headers.get("x-forwarded-host");
  const host = forwarded ?? headers.get("host");
  const first = host?.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * `true` when the request may proceed. A mutation with a Supabase session
 * cookie needs an `Origin` (or `Referer` fallback) whose host matches the
 * request host; anything else is rejected before the session is refreshed.
 */
export function isSameOriginMutation(request: OriginCheckRequest): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  if (!hasSessionCookie(request.headers.get("cookie"))) return true;

  const source = request.headers.get("origin") ?? request.headers.get("referer");
  const host = requestHost(request.headers);
  if (!source || !host) return false;

  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}
