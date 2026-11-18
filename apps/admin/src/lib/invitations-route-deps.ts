import { getInfra } from "@/lib/api/door";
import { createInvitationMailer } from "@/lib/email/invitation-mailer";
import { invitationServiceDeps } from "@/lib/invitation-service-deps";
import type { InvitationsRouteDeps } from "@027apps/core/invitations/api.js";

/** Shared invitation route dependencies: door, caller resolver and DB + Auth ports. */
export async function invitationsRouteDeps(): Promise<InvitationsRouteDeps> {
  const { deps, auth } = await getInfra();
  return {
    door: deps,
    auth,
    invitations: await invitationServiceDeps(),
    mailer: createInvitationMailer(),
  };
}
