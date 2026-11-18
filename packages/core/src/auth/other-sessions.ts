import { DomainError } from "../errors";
import type { Caller } from "../api/types";
import type { QueryClient } from "../api/rate-limit-storage";

export interface OtherSessionsDeps {
  /** Service connection: `auth.sessions` is not reachable with the caller's JWT. */
  db: QueryClient;
}

/**
 * Revokes every session of the caller except the one that asks.
 *
 * Phone migration needs this: the client used to rely on Supabase's
 * `signOut({ scope: "others" })`, but a real migration left the old session
 * alive (it still refreshed), so the expulsion was only local. Doing it on the
 * server, with the session id from the caller's own JWT, removes that
 * dependency and cannot touch the session that is calling.
 */
export async function revokeOtherSessions(
  deps: OtherSessionsDeps,
  caller: Caller,
  keepSessionId: string,
): Promise<{ revoked: number }> {
  if (caller.kind !== "session") throw new DomainError("insufficient_scope");

  // The kept session must belong to the caller: otherwise a user could point at
  // somebody else's session id and this would delete every session they own.
  const { rows: keep } = await deps.db.query(
    "select id from auth.sessions where id = $1 and user_id = $2",
    [keepSessionId, caller.userId],
  );
  if (!keep[0]) throw new DomainError("not_found");

  const { rows } = await deps.db.query(
    "delete from auth.sessions where user_id = $1 and id <> $2 returning id",
    [caller.userId, keepSessionId],
  );
  return { revoked: rows.length };
}
