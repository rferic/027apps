import { revokeInvitationGrantRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** DELETE /api/v1/users/{id}/invitation-grants/{grantId} — revoke, keep history. */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; grantId: string }> },
) {
  const { id, grantId } = await ctx.params;
  return revokeInvitationGrantRoute(await invitationsRouteDeps())(req, id, grantId);
}
