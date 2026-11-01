import { patchCurrencyRoute } from "@027apps/core/currencies/api.js";
import { deps, auth, currenciesDeps } from "@/lib/api/door";

const handler = patchCurrencyRoute({ door: deps, auth, currencies: currenciesDeps });

/** PATCH /api/v1/currencies/{code} — enable/disable; the default cannot be disabled. */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handler(req, code);
}
