import type { MemberPatch } from "@/lib/member-form";

export type MutationResult =
  | { ok: true }
  | { ok: false; code?: string; requestId?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Public envelope fields only; unknown shapes degrade to a plain failure. */
function failure(value: unknown, headerRequestId?: string): MutationResult {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = readString(error.code);
  const requestId = readString(error.request_id) ?? headerRequestId;
  return {
    ok: false,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

async function readMutation(res: Response): Promise<MutationResult> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return res.ok ? { ok: true } : { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
  }
  if (!res.ok) return failure(body, headerRequestId);
  return { ok: true };
}

/**
 * Same-origin fetch from the browser: cookies travel automatically, so the
 * panel never adds an Authorization header or a service token to the bundle.
 */
export async function patchMember(
  id: string,
  patch: MemberPatch,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

/** DELETE is a soft deactivation on the Core; the API owns the invariants. */
export async function deactivateMember(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}
