import { createInvitationRequestRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/me/invitation-requests — ask an admin to raise the quota. */
export async function POST(req: Request) {
  return createInvitationRequestRoute(await invitationsRouteDeps())(req);
}
