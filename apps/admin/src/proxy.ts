import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { enforcedCsp, strictReportOnlyCsp } from "@/lib/content-security-policy";
import { entryGate } from "@/lib/instance-gate";
import { readInstanceState } from "@/lib/instance-state";
import { isPublicPath } from "@/lib/public-paths";
import { isSameOriginMutation } from "@/lib/same-origin";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/** Paths whose access depends on the instance state (the gate's inputs). */
const GATED_PATHS = new Set(["/setup", "/login", "/panel"]);

/**
 * Session refresh at the edge (Next.js 16 proxy file — `middleware.ts` is
 * deprecated). Runs before every page render and every `/api/v1` call: verifies
 * the Supabase session and refreshes the access token (JWT expiry = 900 s).
 *
 * For `/api/v1` it forwards the access token as `Authorization: Bearer`, which
 * is how the door authenticates (ADR 0004): the browser keeps the session in
 * HttpOnly cookies and never sees the token. The door verifies it again.
 *
 * It also emits two Content-Security-Policy headers. The enforced one is
 * pragmatic: it pins scripts, frames, forms and connections to our own origin
 * while still allowing inline scripts, because with Cache Components every route
 * prerenders a static shell that cannot carry a per-request nonce. The strict
 * nonce-based policy runs alongside it in Report-Only mode, so violations show
 * up in the browser console as observation; hardening the enforced policy means
 * dropping the prerendered shells first (`lib/content-security-policy.ts`).
 */
export async function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = enforcedCsp(isDev);
  const reportOnlyPolicy = strictReportOnlyCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  if (isPublicPath(request.nextUrl.pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applyContentSecurityPolicies(response, contentSecurityPolicy, reportOnlyPolicy);
    return response;
  }

  // The door accepts either a Bearer token or the session cookie. Browsers
  // attach cookies to cross-site requests, so a cookie-authenticated mutation
  // must prove its origin before the session is refreshed or the token
  // forwarded. Bearer-only callers (API keys, mobile) are not affected.
  if (request.nextUrl.pathname.startsWith("/api/v1") && !isSameOriginMutation(request)) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Cross-origin request rejected" } },
      { status: 403 },
    );
  }

  const { supabase, refreshedCookies } = sessionClient(request);
  const hasSession = await refreshSession(
    supabase,
    request.nextUrl.pathname,
    requestHeaders,
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applyContentSecurityPolicies(response, contentSecurityPolicy, reportOnlyPolicy);
  for (const { name, value, options } of refreshedCookies) response.cookies.set(name, value, options);

  // Entry gate: setup wizard, login and the panel are only reachable in the
  // order the instance state allows. A page-level `redirect()` would flush the
  // shell first and answer 200 in production, so routing happens here.
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  // Only the three entry pages need the instance state: avoid a DB round trip
  // on every other GET (API routes, pages behind the panel).
  if (!GATED_PATHS.has(request.nextUrl.pathname)) return response;

  const state = await readInstanceState();
  const target = entryGate(request.nextUrl.pathname, {
    installed: state.installed,
    setupIncomplete: state.setupIncomplete,
    hasSession,
  });
  return target ? redirectWithSession(request, response, target) : response;
}

/** Supabase SSR client whose refreshed cookies are collected for the response. */
function sessionClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
  }

  const refreshedCookies: Array<{ name: string; value: string; options?: CookieOptions }> = [];
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        refreshedCookies.push(...cookiesToSet);
      },
    },
  });
  return { supabase, refreshedCookies };
}

type SessionClient = ReturnType<typeof sessionClient>["supabase"];

/**
 * One verification per request:
 * - `/api/v1`: the door verifies the JWT; the proxy only forwards (and
 *   refreshes) the cookie session.
 * - gated entry pages: the entry gate needs the session, so verify it here.
 * - any other page: the panel layout verifies it; the proxy only refreshes the
 *   cookie when the token is about to expire.
 */
async function refreshSession(
  supabase: SessionClient,
  pathname: string,
  headers: Headers,
): Promise<boolean> {
  if (pathname.startsWith("/api/v1")) {
    await forwardSessionToken(supabase, headers);
    return false;
  }
  if (GATED_PATHS.has(pathname)) {
    const { data } = await supabase.auth.getUser();
    return data.user !== null;
  }
  await supabase.auth.getSession();
  return false;
}

/** Copies the session token onto the upstream request for `/api/v1` calls. */
async function forwardSessionToken(
  supabase: ReturnType<typeof sessionClient>["supabase"],
  headers: Headers,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.set("authorization", `Bearer ${token}`);
}

/** Redirect while keeping the refreshed session cookies and both CSP headers. */
function redirectWithSession(request: NextRequest, from: NextResponse, target: string) {
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of from.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  for (const name of ["content-security-policy", "content-security-policy-report-only"]) {
    const value = from.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

/** Emits the enforced policy and the strict one in Report-Only mode. */
function applyContentSecurityPolicies(
  response: NextResponse,
  enforced: string,
  reportOnly: string,
): void {
  response.headers.set("Content-Security-Policy", enforced);
  response.headers.set("Content-Security-Policy-Report-Only", reportOnly);
}

export const config = {
  matcher: [
    // Pages and `/api/v1` (the proxy adds the Bearer token for the door); no
    // static assets, no images, no `next/link` prefetches.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
