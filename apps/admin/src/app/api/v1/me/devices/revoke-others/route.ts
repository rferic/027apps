import { revokeOtherDevicesRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** POST /api/v1/me/devices/revoke-others — keep the new phone, revoke the rest. */
export async function POST(req: Request) {
  return revokeOtherDevicesRoute(await devicesRouteDeps())(req);
}
