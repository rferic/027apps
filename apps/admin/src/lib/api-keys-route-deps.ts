import { getInfra, withTransactionClient } from "@/lib/api/door";
import type { ApiKeysRouteDeps } from "@027apps/core/api-keys/api.js";

/** Shared API-key route dependencies: door, caller resolver and DB port. */
export async function apiKeysRouteDeps(): Promise<ApiKeysRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    // The five-key check and the insert share one client and a transaction.
    apiKeys: { db: settingsDeps.db, withTransaction: withTransactionClient },
  };
}
