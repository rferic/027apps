import { cache } from "react";
import { getInfra } from "@/lib/api/door";
import { loadModuleManifest } from "@/lib/module-manifests";
import type { PanelRole } from "@/lib/panel-guard";

export interface PanelModuleNavItem {
  key: string;
  name: string;
  color?: string;
}

/**
 * The modules that own a row in the panel sidebar (D27): installed, `active`,
 * and with at least one admin page the caller's role can open. A module with no
 * pages or no state is catalog-only, so the menu never advertises a dead link.
 * Cached per request: the layout and the mobile drawer both ask for it.
 */
export const loadPanelModuleNav = cache(
  async (role: PanelRole): Promise<PanelModuleNavItem[]> => {
    let rows: Record<string, unknown>[] = [];
    try {
      const { settingsDeps } = await getInfra();
      const result = await settingsDeps.db.query(
        "select key, name from public.module_registry where state = 'active' order by name",
      );
      rows = result.rows;
    } catch {
      // The panel still renders without module rows; the catalog explains why.
      return [];
    }

    const items: PanelModuleNavItem[] = [];
    for (const row of rows) {
      const key = String(row.key);
      const manifest = await loadModuleManifest(key);
      const pages =
        manifest?.admin_pages.filter(
          (page) => page.role !== "super_admin" || role === "super_admin",
        ) ?? [];
      if (pages.length === 0) continue;
      items.push({
        key,
        name: manifest?.name ?? String(row.name),
        color: manifest?.branding?.color,
      });
    }
    return items;
  },
);
