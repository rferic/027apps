import { DomainError } from "@027apps/core/errors.js";
import {
  previewInvitation,
  type InvitationPreview,
} from "@027apps/core/invitations/service.js";
import { invitationServiceDeps } from "@/lib/invitation-service-deps";

/**
 * Public preview for the invitation page and the redemption action. A revoked
 * or unknown token is `null` so both render the same generic card (no
 * enumeration); any other failure bubbles up instead of hiding a broken
 * database behind "invalid link".
 */
export async function loadInvitePreview(token: string): Promise<InvitationPreview | null> {
  try {
    return await previewInvitation(await invitationServiceDeps(), token);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return null;
    throw error;
  }
}
