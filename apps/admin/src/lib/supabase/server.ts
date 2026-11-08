import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * Session-scoped Supabase client for Server Components, Route Handlers and
 * Server Actions (@supabase/ssr, cookie-based). `@supabase/ssr` does not make
 * the cookies `HttpOnly` or `Secure` on its own, so the explicit
 * `SESSION_COOKIE_OPTIONS` add both; the token refresh is centralized in
 * `src/proxy.ts`.
 *
 * Create a new client for every server render: never share it across requests.
 * In Next.js 16 `cookies()` is async, so the factory is async too.
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies cannot be written there.
          // `src/proxy.ts` refreshes the session, so the token is not lost.
        }
      },
    },
  });
}
