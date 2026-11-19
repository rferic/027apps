import { rejectInvitationRequestRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/invitation-requests/{id}/reject — refuse with an optional reason. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return rejectInvitationRequestRoute(await invitationsRouteDeps())(req, id);
}
