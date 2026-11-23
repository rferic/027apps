import { approveInvitationRequestRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/invitation-requests/{id}/approve — approve with a seat amount. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return approveInvitationRequestRoute(await invitationsRouteDeps())(req, id);
}
