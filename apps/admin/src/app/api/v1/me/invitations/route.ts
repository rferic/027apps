import {
  createMemberInvitationRoute,
  memberInvitationsRoute,
} from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** GET /api/v1/me/invitations — the caller's quota, invitations and invitees. */
export async function GET(req: Request) {
  return memberInvitationsRoute(await invitationsRouteDeps())(req);
}

/** POST /api/v1/me/invitations — mint a 48-hour anonymous member invitation. */
export async function POST(req: Request) {
  return createMemberInvitationRoute(await invitationsRouteDeps())(req);
}
