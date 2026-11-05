import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { entryGate } from "@/lib/instance-gate";
import { readInstanceState } from "@/lib/instance-state";

/** Paths whose access depends on the instance state (the gate's inputs). */
const GATED_PATHS = new Set(["/", "/setup", "/login"]);

/**
 * Session refresh at the edge (Next.js 16 proxy file — `middleware.ts` is
 * deprecated). Runs before every page render and every `/api/v1` call: verifies
 * the Supabase session and refreshes the access token (JWT expiry = 900 s).
 *
 * For `/api/v1` it forwards the access token as `Authorization: Bearer`, which
 * is how the door authenticates (ADR 0004): the browser keeps the session in
 * HttpOnly cookies and never sees the token. The door verifies it again.
 *
 * It also emits a nonce-based Content-Security-Policy in REPORT-ONLY mode
 * (docs: `next/dist/docs/01-app/02-guides/content-security-policy.md`). With
 * Cache Components every route prerenders a static shell whose inline scripts
 * cannot carry a per-request nonce, so an enforcing CSP would break the app;
 * report-only surfaces violations in the browser console while enforcement
 * stays gated on a real-browser verification pass.
 */
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = reportOnlyCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const { supabase, refreshedCookies } = sessionClient(request);
  // Triggers a token refresh when the access token is expired.
  const { data } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/api/v1")) {
    await forwardSessionToken(supabase, requestHeaders);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", contentSecurityPolicy);
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
    hasSession: data.user !== null,
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

/** Copies the session token onto the upstream request for `/api/v1` calls. */
async function forwardSessionToken(
  supabase: ReturnType<typeof sessionClient>["supabase"],
  headers: Headers,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.set("authorization", `Bearer ${token}`);
}

/** Redirect while keeping the refreshed session cookies and the CSP header. */
function redirectWithSession(request: NextRequest, from: NextResponse, target: string) {
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of from.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  const csp = from.headers.get("content-security-policy-report-only");
  if (csp) redirect.headers.set("Content-Security-Policy-Report-Only", csp);
  return redirect;
}

/** Nonce-based CSP in report-only mode (enforcement awaits a browser pass). */
function reportOnlyCsp(nonce: string, isDev: boolean): string {
  const origin = supabaseOrigin();
  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self'${origin ? ` ${origin}` : ""};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Origin of the Supabase project, allowed in `connect-src` for auth flows. */
function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
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
