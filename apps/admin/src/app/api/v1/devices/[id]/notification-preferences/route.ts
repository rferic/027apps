import {
  notificationPreferencesRoute,
  updateNotificationPreferencesRoute,
} from "@027apps/core/devices/api.js";
import { devicesRouteDeps } from "@/lib/devices-route-deps";

/** GET /api/v1/devices/{id}/notification-preferences — the owner's own device. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return notificationPreferencesRoute(await devicesRouteDeps())(req, id);
}

/** PUT /api/v1/devices/{id}/notification-preferences — master switch and muted kinds. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return updateNotificationPreferencesRoute(await devicesRouteDeps())(req, id);
}
