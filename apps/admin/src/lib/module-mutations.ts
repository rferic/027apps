import { readMutation, type MutationResult } from "@/lib/mutation-result";

/**
 * Module lifecycle mutations. The Core owns the state machine (`409 conflict`
 * on an impossible transition or on an uninstall with active grants), so the
 * panel only forwards the intent and maps the envelope back.
 */
async function post(
  path: string,
  body: Record<string, unknown> | undefined,
  fetcher: typeof fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(path, {
      method: "POST",
      credentials: "same-origin",
      ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}

/** POST /api/v1/modules/{key}/activate — installed or disabled to active. */
export async function activateModule(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  return post(`/api/v1/modules/${encodeURIComponent(key)}/activate`, undefined, fetcher);
}

/** POST /api/v1/modules/{key}/deactivate — active to disabled; nothing is destroyed. */
export async function deactivateModule(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  return post(`/api/v1/modules/${encodeURIComponent(key)}/deactivate`, undefined, fetcher);
}

/** POST /api/v1/modules/{key}/upgrade — apply a newer trusted package, keeping data. */
export async function upgradeModule(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  return post(`/api/v1/modules/${encodeURIComponent(key)}/upgrade`, undefined, fetcher);
}

/**
 * POST /api/v1/modules/{key}/uninstall — a module with active grants answers
 * `409 conflict` until the caller confirms again with `confirm: true`.
 */
export async function uninstallModule(
  key: string,
  confirm: boolean,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  return post(`/api/v1/modules/${encodeURIComponent(key)}/uninstall`, { confirm }, fetcher);
}
