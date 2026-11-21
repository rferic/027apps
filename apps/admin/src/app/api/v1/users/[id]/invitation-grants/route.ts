import {
  grantInvitationQuotaRoute,
  listInvitationGrantsRoute,
} from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** GET /api/v1/users/{id}/invitation-grants — active and revoked grants. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return listInvitationGrantsRoute(await invitationsRouteDeps())(req, id);
}

/** POST /api/v1/users/{id}/invitation-grants — a direct grant (users:write). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return grantInvitationQuotaRoute(await invitationsRouteDeps())(req, id);
}
