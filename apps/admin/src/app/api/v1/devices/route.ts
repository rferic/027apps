import { devicesRoute, registerDeviceRoute } from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** GET/POST /api/v1/devices — own devices (admins may filter by `?user=`). */
export async function GET(req: Request) {
  return devicesRoute(await devicesRouteDeps())(req);
}

export async function POST(req: Request) {
  return registerDeviceRoute(await devicesRouteDeps())(req);
}
