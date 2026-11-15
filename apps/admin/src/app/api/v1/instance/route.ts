import { instanceRoute } from "@027apps/core/instance/api.js";
import { CORE_VERSION } from "@027apps/core/version.js";
import { getInfra } from "@/lib/api/door";

/**
 * Public Supabase coordinates for native clients. The anon key is the same one
 * the browser already gets; the service role key is never read here.
 */
function authConfig(): { supabaseUrl: string; supabaseAnonKey: string } | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

/** GET /api/v1/instance — public door: version, setup state, auth and public settings. */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return instanceRoute({
    door: deps,
    auth,
    settings: settingsDeps,
    version: CORE_VERSION,
    authConfig: authConfig(),
  })(req);
}
