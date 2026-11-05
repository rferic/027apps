import { patchCurrencyRoute } from "@027apps/core/currencies/api.js";
import { getInfra } from "@/lib/api/door";

/** PATCH /api/v1/currencies/{code} — enable/disable; the default cannot be disabled. */
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const { deps, auth, currenciesDeps } = await getInfra();
  return patchCurrencyRoute({ door: deps, auth, currencies: currenciesDeps })(req, code);
}
