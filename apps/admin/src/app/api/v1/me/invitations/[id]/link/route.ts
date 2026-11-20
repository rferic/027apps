import { rotateMemberInvitationLinkRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * POST /api/v1/me/invitations/{id}/link — re-issue the link of one of the
 * caller's own pending invitations, so the app can show its QR again.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return rotateMemberInvitationLinkRoute(await invitationsRouteDeps())(req, id);
}
