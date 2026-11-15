import { moduleIconRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** GET /api/v1/modules/{key}/icon — the module's branded SVG. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return moduleIconRoute(await modulesRouteDeps())(req, key);
}
