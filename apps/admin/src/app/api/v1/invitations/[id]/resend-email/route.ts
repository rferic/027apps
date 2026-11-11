import { resendInvitationRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * POST /api/v1/invitations/{id}/resend-email — issue a new token and send the
 * invitation again. Only pending invitations; 60 s cooldown per invitation.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return resendInvitationRoute(await invitationsRouteDeps())(req, id);
}
