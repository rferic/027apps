import { getInfra, runInTransaction } from "@/lib/api/door";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DemoRouteDeps } from "@027apps/core/demo/api.js";

/**
 * Demo data dependencies: the Core owns the rows and the Supabase Admin API
 * creates the sample auth users, so their password works for the app.
 */
export async function demoRouteDeps(): Promise<DemoRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  const admin = createSupabaseAdminClient();
  return {
    door: deps,
    auth,
    demo: {
      db: settingsDeps.db,
      withTransaction: runInTransaction,
      auth: {
        async createUser(email, password) {
          const created = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
          if (created.error || !created.data.user) throw new Error("createUser failed");
          return { userId: created.data.user.id };
        },
        async deleteUser(userId) {
          const { error } = await admin.auth.admin.deleteUser(userId);
          if (error) throw new Error("deleteUser failed");
        },
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        allowDemo: process.env.ALLOW_DEMO_DATA,
      },
    },
  };
}
