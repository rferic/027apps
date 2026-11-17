import { exchangeDeviceTransferRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/**
 * POST /api/v1/device-transfers/{token}/exchange — public new-phone exchange.
 * `token` is the `027_mig_` migration code, not a UUID.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return exchangeDeviceTransferRoute(await devicesRouteDeps())(req, token);
}
