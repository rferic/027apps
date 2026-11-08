import { failureFrom, withoutBody, type MutationResult } from "@/lib/mutation-result";

export interface RedeemInvitationInput {
  token: string;
  email: string;
  password: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Public redemption call. The token is the capability: it travels in the path
 * only, never in the body, storage or a log.
 *
 * It deliberately does not use `readMutation`: that helper accepts any 2xx
 * response whose body is a JSON object, but this endpoint's contract creates
 * the account with `201` (JSON object) or, if ever changed, `204`. A `200`
 * with a JSON body is not proof of creation (a proxy or a future gateway could
 * answer it), so success here is narrower than the generic rule.
 */
export async function redeemInvitation(
  input: RedeemInvitationInput,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/invitations/${encodeURIComponent(input.token)}/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: input.email.trim(), password: input.password }),
    });
  } catch {
    return { ok: false };
  }

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;

  if (!res.ok) {
    try {
      return failureFrom(JSON.parse(await res.text()), headerRequestId);
    } catch {
      return withoutBody(headerRequestId);
    }
  }

  if (res.status === 204) return { ok: true };
  if (res.status !== 201) return withoutBody(headerRequestId);

  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return withoutBody(headerRequestId);
  }
  return isRecord(body) ? { ok: true } : withoutBody(headerRequestId);
}
