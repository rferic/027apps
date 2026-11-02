import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh at the edge (Next.js 16 proxy file — `middleware.ts` is
 * deprecated). Runs before every page render: verifies the Supabase session,
 * refreshes the access token (JWT expiry = 900 s) and writes the rotated
 * cookies back onto the response.
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
  const isDev = process.env.NODE_ENV === "development";
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self'${supabaseOrigin() ? ` ${supabaseOrigin()}` : ""};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
`;
  const contentSecurityPolicy = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", contentSecurityPolicy);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Triggers a token refresh when the access token is expired; the rotated
  // cookies are written through the `setAll` above.
  await supabase.auth.getUser();

  return response;
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
    // HTML page requests only: no API routes (Bearer-authenticated doors), no
    // static assets, no images, no `next/link` prefetches.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
