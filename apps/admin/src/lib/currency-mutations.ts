import { readMutation, type MutationResult } from "@/lib/mutation-result";

/** PATCH /api/v1/currencies/{code}; the Core refuses to disable the default. */
export async function setCurrencyEnabled(
  code: string,
  enabled: boolean,
  fetcher: typeof fetch = fetch,
): Promise<MutationResult> {
  let res: Response;
  try {
    res = await fetcher(`/api/v1/currencies/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ enabled }),
    });
  } catch {
    return { ok: false };
  }
  return readMutation(res);
}
