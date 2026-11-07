import type { MemberPatch } from "@/lib/member-form";

/** Public `error.details` shape for `validation_failed` (zod `.flatten()`). */
export interface MutationErrorDetails {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}

export type MutationResult =
  | { ok: true }
  | { ok: false; code?: string; requestId?: string; details?: MutationErrorDetails };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readFieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const fieldErrors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    const parsed = readStringArray(messages);
    if (parsed) fieldErrors[field] = parsed;
  }
  return fieldErrors;
}

/** Only the documented detail fields survive; anything else is dropped. */
function readDetails(value: unknown): MutationErrorDetails | undefined {
  if (!isRecord(value)) return undefined;
  const formErrors = readStringArray(value.formErrors);
  const fieldErrors = readFieldErrors(value.fieldErrors);
  if (!formErrors && !fieldErrors) return undefined;
  return {
    ...(formErrors ? { formErrors } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

/** Public envelope fields only; unknown shapes degrade to a plain failure. */
function failure(value: unknown, headerRequestId?: string): MutationResult {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = readString(error.code);
  const requestId = readString(error.request_id) ?? headerRequestId;
  const details = readDetails(error.details);
  return {
    ok: false,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
    ...(details ? { details } : {}),
  };
}

function withoutBody(headerRequestId?: string): MutationResult {
  return { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
}

/**
 * A mutation counts as successful only with `204 No Content` or a JSON object
 * body. A proxy or a maintenance page can answer 2xx with HTML: that is not
 * proof the Core applied the change, so it must not read as success.
 */
async function readMutation(res: Response): Promise<MutationResult> {
  const headerRequestId = res.headers.get("x-request-id") ?? undefined;

  if (!res.ok) {
    let body: unknown;
    try {
      body = JSON.parse(await res.text());
    } catch {
      return withoutBody(headerRequestId);
    }
    return failure(body, headerRequestId);
  }

  if (res.status === 204) return { ok: true };

  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return withoutBody(headerRequestId);
  }
  if (!isRecord(body)) return withoutBody(headerRequestId);
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
