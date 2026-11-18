import { createDeviceTransferRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** POST /api/v1/me/device-transfers — mint the old phone's 60-second QR code. */
export async function POST(req: Request) {
  return createDeviceTransferRoute(await devicesRouteDeps())(req);
}
