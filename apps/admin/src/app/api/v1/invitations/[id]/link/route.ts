import { invitationLinkRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * POST /api/v1/invitations/{id}/link — issue a new token without sending it,
 * for the manual copy fallback. Invalidates the previous link.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return invitationLinkRoute(await invitationsRouteDeps())(req, id);
}
