import { createClient } from "@supabase/supabase-js";

/**
 * Service client for the server (`SUPABASE_SERVICE_ROLE_KEY`): bypasses RLS.
 * Server-only: never import from a client component. The key has no
 * `NEXT_PUBLIC_` prefix, so it is not shipped to the browser.
 *
 * Used by doors (`rate_limit_counters`), the setup flow (Admin Auth API) and
 * server-internal reads (settings with the encryption port).
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
