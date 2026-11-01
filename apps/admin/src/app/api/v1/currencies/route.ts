import { currenciesRoute } from "@027apps/core/currencies/api.js";
import { deps, auth, currenciesDeps } from "@/lib/api/door";

/** GET /api/v1/currencies — authenticated: enabled currencies + default. */
export const GET = currenciesRoute({ door: deps, auth, currencies: currenciesDeps });
