import { revokeDeviceRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** DELETE /api/v1/devices/{id} — soft revoke + drop the user's sessions. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return revokeDeviceRoute(await devicesRouteDeps())(req, id);
}
