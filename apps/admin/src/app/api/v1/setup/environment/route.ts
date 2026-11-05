import { setupEnvironmentRoute } from "@027apps/core/setup/api.js";
import { hasActiveSuperAdmin } from "@027apps/core/instance/api.js";
import { getInfra } from "@/lib/api/door";

/**
 * GET /api/v1/setup/environment — step 1 checks (public only while the instance
 * has no super_admin). Reports connection, migrations, encryption key and the
 * optional Sentry DSN; never returns env values.
 */
export async function GET(req: Request) {
  const { deps, auth, settingsDeps } = await getInfra();
  return setupEnvironmentRoute({
    door: deps,
    auth,
    installed: () => hasActiveSuperAdmin(settingsDeps),
    env: {
      db: settingsDeps.db,
      encryptionKey: {
        present: Boolean(process.env.SETTINGS_ENCRYPTION_KEY),
        valid: settingsDeps.encryption !== null,
      },
      sentryConfigured: Boolean(process.env.SENTRY_DSN),
    },
  })(req);
}
