import { apiKeyRoute, revokeApiKeyRoute, updateApiKeyRoute } from "@027apps/core/api-keys/api.js";
import { apiKeysRouteDeps } from "@/lib/api-keys-route-deps";

/** GET/PATCH/DELETE /api/v1/api-keys/{id} — detail, edit and revoke. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return apiKeyRoute(await apiKeysRouteDeps())(req, id);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return updateApiKeyRoute(await apiKeysRouteDeps())(req, id);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return revokeApiKeyRoute(await apiKeysRouteDeps())(req, id);
}
