import { apiKeyRoute, revokeApiKeyRoute } from "@027apps/core/api-keys/api.js";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";

/** GET/DELETE /api/v1/api-keys/{id} — detail (no secret) and revoke. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return apiKeyRoute(await apiKeysRouteDeps())(req, id);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return revokeApiKeyRoute(await apiKeysRouteDeps())(req, id);
}
