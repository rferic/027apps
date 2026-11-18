import { renewInvitationRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/invitations/{id}/renew — renew an expired invitation. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return renewInvitationRoute(await invitationsRouteDeps())(req, id);
}
