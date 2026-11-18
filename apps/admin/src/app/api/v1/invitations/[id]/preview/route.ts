import { invitationPreviewRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * GET /api/v1/invitations/{token}/preview — public preview for the invitee.
 * `id` carries the invitation token (it is not a UUID).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return invitationPreviewRoute(await invitationsRouteDeps())(req, id);
}
