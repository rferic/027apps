import { DomainError } from "@027apps/core/errors.js";
import {
  previewJoinCode,
  type JoinCodePreview,
} from "@027apps/core/invitations/join-codes.js";
import { invitationServiceDeps } from "@/lib/invitation-service-deps";

/**
 * Public preview for the `/join/[code]` page. An unknown, expired-malformed or
 * revoked code is `null` so the page renders the same generic card (no
 * enumeration); any other failure bubbles up instead of hiding a broken
 * database behind "invalid code".
 */
export async function loadJoinPreview(code: string): Promise<JoinCodePreview | null> {
  try {
    return await previewJoinCode(await invitationServiceDeps(), code);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") return null;
    throw error;
  }
}
