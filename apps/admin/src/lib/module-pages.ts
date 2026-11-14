import type { ComponentType } from "react";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import FixtureOverview from "@027apps/fixture/admin/overview/page";
import OweNoGroups from "@/components/owe-no/groups-page";
import OweNoImports from "@027apps/owe-no/admin/imports/page";
import OweNoOverview from "@027apps/owe-no/admin/overview/page";

/**
 * Static registry of module admin pages.
 *
 * Next/Turbopack cannot bundle a path built from route params, so every page a
 * module ships is imported here explicitly and keyed by `<module>/<route>`. The
 * manifest decides whether the route exists and who may see it; this map only
 * says which component renders it. A manifest page without an entry 404s: the
 * panel never renders a package's page from an untrusted path.
 */
export const MODULE_PAGES: Record<string, ComponentType<{ context: ModulePageContext }>> = {
  "fixture/overview": FixtureOverview,
  "owe-no/overview": OweNoOverview,
  "owe-no/groups": OweNoGroups,
  "owe-no/imports": OweNoImports,
};
