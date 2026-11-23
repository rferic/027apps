import { revokeMemberInvitationRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** DELETE /api/v1/me/invitations/{id} — revoke one of the caller's own invitations. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return revokeMemberInvitationRoute(await invitationsRouteDeps())(req, id);
}
