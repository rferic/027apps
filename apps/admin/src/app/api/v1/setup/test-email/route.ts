import { setupTestEmailRoute } from "@027apps/core/setup/api.js";
import { hasActiveSuperAdmin } from "@027apps/core/instance/api.js";
import { getInfra } from "@/lib/api/door";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/setup/test-email — step 3. Sends a mail through the project's
 * SMTP to the authenticated super_admin's own address (never to an address from
 * the request). Rate limited to 3 attempts per minute by the door.
 */
export async function POST(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return setupTestEmailRoute({
    door: deps,
    auth,
    installed: () => hasActiveSuperAdmin(settingsDeps),
    async sendTestEmail(userId) {
      const adminClient = createSupabaseAdminClient();
      const { data, error } = await adminClient.auth.admin.getUserById(userId);
      const email = data.user?.email;
      if (error || !email) throw new Error("super_admin email not found");

      // A recovery mail exercises the exact path a real user would use.
      const serverClient = await createSupabaseServerClient();
      const { error: sendError } = await serverClient.auth.resetPasswordForEmail(email);
      if (sendError) throw new Error(sendError.message);
    },
  })(req);
}
