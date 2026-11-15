import { moduleJobRunRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST /api/v1/modules/{key}/jobs/{job}/run — run one job now. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ key: string; job: string }> },
) {
  const { key, job } = await params;
  return moduleJobRunRoute(await modulesRouteDeps())(req, key, job);
}
