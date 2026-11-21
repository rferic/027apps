import { readMutation, type MutationResult } from "@/lib/mutation-result";

/**
 * Client-side quota-request mutations (sprint 18 spec §6.4). Same-origin
 * fetches carry the session cookie and never a token; kept in a client-safe
 * module (no server imports) so the `InvitationRequestActions` and the badge
 * client components can bundle them without pulling `pg` into the browser.
 */

/** POST /invitation-requests/{id}/approve — grant the approved seat amount. */
export async function approveInvitationRequest(
  id: string,
  amount: number,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/invitation-requests/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ amount }),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

/** POST /invitation-requests/{id}/reject — refuse with an optional reason. */
export async function rejectInvitationRequest(
  id: string,
  reason?: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/invitation-requests/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(reason ? { reason } : {}),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pending count for the badge. A `limit=1` read is enough: the route returns
 * the full `total` regardless of the page window. A failure reads as zero so a
 * transient error never paints a wrong number on the navigation.
 */
export async function fetchPendingRequestCount(fetcher: typeof fetch = fetch): Promise<number> {
  try {
    const res = await fetcher("/api/v1/invitation-requests?state=pending&limit=1", {
      credentials: "same-origin",
    });
    if (!res.ok) return 0;
    const body: unknown = await res.json();
    if (isRecord(body) && typeof body.total === "number" && Number.isInteger(body.total)) {
      return body.total;
    }
    return 0;
  } catch {
    return 0;
  }
}
