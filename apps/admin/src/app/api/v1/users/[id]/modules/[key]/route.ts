import { grantUserModuleRoute, revokeUserModuleRoute } from "@027apps/core/modules/api.js";
import { modulesRouteDeps } from "@/lib/modules-route-deps";

/** POST/DELETE /api/v1/users/{id}/modules/{key} — grant or revoke module access. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await ctx.params;
  return grantUserModuleRoute(await modulesRouteDeps())(req, id, key);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; key: string }> },
) {
  const { id, key } = await ctx.params;
  return revokeUserModuleRoute(await modulesRouteDeps())(req, id, key);
}
