import {
  failureFrom,
  readMutation,
  withoutBody,
  type MutationFailure,
  type MutationResult,
} from "@/lib/mutation-result";

export interface CreateApiKeyInput {
  kind: "service" | "delegated";
  name: string;
  scopes: string[];
  /** Only meaningful for service keys; the API defaults it to `admin`. */
  role_cap?: "admin" | "super_admin";
}

export type CreateApiKeyResult = { ok: true; secret?: string } | MutationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function bodyOrFailure(res: Response): Promise<MutationFailure> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  try {
    return failureFrom(JSON.parse(await res.text()), headerRequestId);
  } catch {
    return withoutBody(headerRequestId);
  }
}

/**
 * The Core returns the plaintext secret exactly once, in this response
 * (`createApiKey` contract). It is kept in client state only: never a URL, a
 * cookie, storage or a log.
 */
export async function createApiKey(
  input: CreateApiKeyInput,
  fetcher: typeof fetch = fetch,
): Promise<CreateApiKeyResult> {
  let res: Response;
  try {
    res = await fetcher("/api/v1/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false };
  }

  if (!res.ok) return bodyOrFailure(res);
  if (res.status === 204) return { ok: true };

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await res.text());
  } catch {
    return withoutBody(headerRequestId);
  }
  if (!isRecord(parsed)) return withoutBody(headerRequestId);
  const secret = readString(parsed.secret);
  return { ok: true, ...(secret ? { secret } : {}) };
}

/** Revocation is immediate on the Core; the API owns the owner/role rules. */
export async function revokeApiKey(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}
