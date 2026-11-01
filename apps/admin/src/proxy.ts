import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh at the edge (Next.js 16 proxy file — `middleware.ts` is
 * deprecated). Runs before every render: verifies the Supabase session,
 * refreshes the access token (JWT expiry = 900 s) and writes the rotated
 * cookies back onto the response.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

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
    },
  );

  // Triggers a token refresh when the access token is expired; the rotated
  // cookies are written through the `setAll` above.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // All routes except static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
