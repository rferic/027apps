import { apiKeysRoute, createApiKeyRoute } from "@027apps/core/api-keys/api.js";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";

/** GET/POST /api/v1/api-keys — list own (or all as super_admin) and create. */
export async function GET(req: Request) {
  return apiKeysRoute(await apiKeysRouteDeps())(req);
}

export async function POST(req: Request) {
  return createApiKeyRoute(await apiKeysRouteDeps())(req);
}
