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
 * only, never in the body, storage or a log. A success is `201` with a JSON
 * object (or `204`), the same rule as `readMutation`: a 2xx HTML page from a
 * proxy does not prove the account was created.
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
