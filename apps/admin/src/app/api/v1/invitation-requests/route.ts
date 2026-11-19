import { listInvitationRequestsRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** GET /api/v1/invitation-requests — the admin list, pending first. */
export async function GET(req: Request) {
  return listInvitationRequestsRoute(await invitationsRouteDeps())(req);
}
