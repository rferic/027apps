import { createInvitationRoute, invitationsRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** GET/POST /api/v1/invitations — list and create single-use invitations. */
export async function GET(req: Request) {
  return invitationsRoute(await invitationsRouteDeps())(req);
}

export async function POST(req: Request) {
  return createInvitationRoute(await invitationsRouteDeps())(req);
}
