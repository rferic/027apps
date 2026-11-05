import { revokeInvitationRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** DELETE /api/v1/invitations/{id} — revoke a pending invitation (soft). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return revokeInvitationRoute(await invitationsRouteDeps())(req, id);
}
