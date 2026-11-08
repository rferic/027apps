import { readMutation, type MutationResult } from "@/lib/mutation-result";

/**
 * One bulk request for every changed setting (task-04 batch endpoint): atomic
 * on the Core and one rate-limit unit instead of one per field.
 */
export async function patchSettingsBatch(
  updates: ReadonlyArray<{ key: string; value: unknown }>,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  if (updates.length === 0) return { ok: true };

  let res: Response;
  try {
    res = await fetcher("/api/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ updates }),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}
