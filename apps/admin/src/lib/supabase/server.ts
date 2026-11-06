import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Session-scoped Supabase client for Server Components, Route Handlers and
 * Server Actions (@supabase/ssr, cookie-based). Cookies are `HttpOnly`,
 * `Secure` (in production) and `SameSite=Lax` by default; the token refresh is
 * centralized in `src/proxy.ts`.
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
