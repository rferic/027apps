import { redeemInvitationRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/**
 * POST /api/v1/invitations/{id}/redeem — public single-use redemption.
 * `id` carries the invitation token (it is not a UUID).
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return redeemInvitationRoute(await invitationsRouteDeps())(req, id);
}
