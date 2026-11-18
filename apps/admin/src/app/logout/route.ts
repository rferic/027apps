import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACCESS_REVOKED = "/login?reason=access_revoked";

/**
 * Forced local logout for a session that cannot be used (deactivated profile,
 * deleted member, revoked session). `/login` cannot clear the cookies itself,
 * and a stale session there would bounce back to `/panel` forever. Only a
 * same-origin navigation may trigger it; a cross-site image/link is rejected.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  let failed = false;
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The redirect must still clear the browser's Supabase cookies.
    failed = true;
  }

  const reason = request.nextUrl.searchParams.get("reason");
  const target = reason === "access_revoked" ? ACCESS_REVOKED : "/login";
  const response = NextResponse.redirect(new URL(target, request.url));

  // `signOut` normally clears these through the SSR client; if the network
  // failed (`failed`) or a chunk was left behind, expire them explicitly.
  if (failed) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) response.cookies.delete(cookie.name);
    }
  }

  return response;
}
