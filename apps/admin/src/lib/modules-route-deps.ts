import { getInfra, withTransactionClient } from "@/lib/api/door";
import { loadModuleManifest, moduleRoot, readModuleFile } from "@/lib/modules";
import type { ModulesRouteDeps } from "@027apps/core/modules/api.js";

/** Shared module route dependencies: door, trusted manifest loader and DB ports. */
export async function modulesRouteDeps(): Promise<ModulesRouteDeps> {
  const { deps, auth, settingsDeps } = await getInfra();
  return {
    door: deps,
    auth,
    manifest: loadModuleManifest,
    modules: {
      db: settingsDeps.db,
      withTransaction: withTransactionClient,
      readFile: readModuleFile,
      moduleRoot,
      ...(settingsDeps.encryption ? { encryption: settingsDeps.encryption } : {}),
    },
  };
}
