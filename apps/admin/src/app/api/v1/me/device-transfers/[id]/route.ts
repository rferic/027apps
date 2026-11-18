import { deviceTransferStatusRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** GET /api/v1/me/device-transfers/{id} — old-phone polling. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return deviceTransferStatusRoute(await devicesRouteDeps())(req, id);
}
