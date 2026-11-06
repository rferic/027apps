import { cache } from "react";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { getInfra } from "@/lib/api/door";

/**
 * Public instance settings shared by the panel layout and its pages: `cache()`
 * collapses both reads into one per request instead of querying settings twice.
 */
export const loadPanelSettings = cache(async () => {
  const { settingsDeps } = await getInfra();
  return readPublicSettings(settingsDeps);
});
