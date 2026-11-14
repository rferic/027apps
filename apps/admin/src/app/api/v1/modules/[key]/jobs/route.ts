import { moduleJobRunsRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/modules/{key}/jobs — last runs of the module's scheduled jobs. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  return moduleJobRunsRoute(await modulesRouteDeps())(req, key);
}
