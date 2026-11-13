import type { ComponentType } from "react";
import FixtureOverview from "@027apps/fixture/admin/overview/page";

/**
 * Static registry of module admin pages.
 *
 * Next/Turbopack cannot bundle a path built from route params, so every page a
 * module ships is imported here explicitly and keyed by `<module>/<route>`. The
 * manifest decides whether the route exists and who may see it; this map only
 * says which component renders it. A manifest page without an entry 404s: the
 * panel never renders a package's page from an untrusted path.
 */
export const MODULE_PAGES: Record<string, ComponentType> = {
  "fixture/overview": FixtureOverview,
};
