import { currenciesRoute } from "@027apps/core/currencies/api.js";
import { getInfra } from "@/lib/api/door";

/** GET /api/v1/currencies — authenticated: enabled currencies + default. */
export async function GET(req: Request) {
  const { deps, auth, currenciesDeps } = await getInfra();
  return currenciesRoute({ door: deps, auth, currencies: currenciesDeps })(req);
}
