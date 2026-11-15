import { upgradeModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/upgrade — apply the newer trusted package. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  return upgradeModuleRoute(await modulesRouteDeps())(req, key);
}
