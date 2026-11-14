import { demoClearRoute, demoSeedRoute, demoStatusRoute } from "@027apps/core/demo/api.js";
import { demoRouteDeps } from "@/lib/demo-route-deps";

/** GET /api/v1/demo — demo dataset status (admins). */
export async function GET(req: Request) {
  return demoStatusRoute(await demoRouteDeps())(req);
}

/** POST /api/v1/demo — seed the demo dataset (admins, idempotent). */
export async function POST(req: Request) {
  return demoSeedRoute(await demoRouteDeps())(req);
}

/** DELETE /api/v1/demo — clear the demo dataset (admins). */
export async function DELETE(req: Request) {
  return demoClearRoute(await demoRouteDeps())(req);
}
