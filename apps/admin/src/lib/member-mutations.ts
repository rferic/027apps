import type { MemberPatch } from "@/lib/member-form";
import { readMutation, type MutationResult } from "@/lib/mutation-result";

export type { MutationErrorDetails, MutationResult } from "@/lib/mutation-result";

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

/** POST /users/{id}/restore undoes that soft deactivation (super_admin). */
export async function restoreMember(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/users/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}
