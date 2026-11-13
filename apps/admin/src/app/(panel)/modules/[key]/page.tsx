import { redirect } from "next/navigation";
import { loadModuleManifest } from "@/lib/module-manifests";

/**
 * Module entry (D20): the module opens on its summary. When the package ships
 * an `overview` page and the module is active, every other destination (the
 * list, the dashboard widget, a bookmark) lands there; otherwise it falls back
 * to the settings page, which is where the install/activate actions live. The
 * module's states are checked by the destination, so this redirect stays cheap.
 */
export default async function ModuleEntryPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const manifest = await loadModuleManifest(key);
  const hasOverview = manifest?.admin_pages.some((page) => page.route === "overview");
  redirect(
    hasOverview
      ? `/modules/${encodeURIComponent(key)}/overview`
      : `/modules/${encodeURIComponent(key)}/settings`,
  );
}
