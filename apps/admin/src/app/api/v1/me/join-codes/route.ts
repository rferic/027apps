import { createJoinCodeRoute } from "@027apps/core/invitations/api.js";
import { invitationsRouteDeps } from "@/lib/invitations-route-deps";

/** POST /api/v1/me/join-codes — mint a 90-second rotating QR code. */
export async function POST(req: Request) {
  return createJoinCodeRoute(await invitationsRouteDeps())(req);
}
