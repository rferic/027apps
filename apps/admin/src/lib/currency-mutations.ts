import { readMutation, type MutationResult } from "@/lib/mutation-result";

/**
 * PATCH /api/v1/currencies — the whole batch in one request (one transaction
 * and one write slot). The Core refuses to disable the default currency.
 */
export async function patchCurrencies(
  updates: ReadonlyArray<{ code: string; enabled: boolean }>,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  if (updates.length === 0) return { ok: true };

  let res: Response;
  try {
    res = await fetcher("/api/v1/currencies", {
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
