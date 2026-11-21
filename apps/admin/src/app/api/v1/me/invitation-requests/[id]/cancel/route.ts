import { cancelInvitationRequestRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/me/invitation-requests/{id}/cancel — withdraw a pending request. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return cancelInvitationRequestRoute(await invitationsRouteDeps())(req, id);
}
