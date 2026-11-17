import type { InvitationsDeps } from "@027apps/core/invitations/service.js";
import { getInfra, withTransactionClient } from "@/lib/api/door";
import { createInvitationsAuth } from "@/lib/invitations";

/**
 * Invitation service dependencies without the HTTP door: the public page and
 * the server action call the Core in process, while the public API route builds
 * its own door on top of the same database and Auth ports.
 */
export async function invitationServiceDeps(): Promise<InvitationsDeps> {
  const { settingsDeps } = await getInfra();
  return {
    db: settingsDeps.db,
    withTransaction: withTransactionClient,
    auth: createInvitationsAuth(settingsDeps.db),
  };
}
