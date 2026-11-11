import { getInfra, withTransactionClient } from "@/lib/api/door";
import { createInvitationsAuth } from "@/lib/invitations";
import { createInvitationMailer } from "@/lib/email/invitation-mailer";
import type { InvitationsRouteDeps } from "@027apps/core/invitations/api.js";

/** Shared invitation route dependencies: door, caller resolver and DB + Auth ports. */
export async function invitationsRouteDeps(): Promise<InvitationsRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    invitations: {
      db: settingsDeps.db,
      withTransaction: withTransactionClient,
      auth: createInvitationsAuth(settingsDeps.db),
    },
    mailer: createInvitationMailer(),
  };
}
