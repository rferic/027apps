import { ModulePageHost } from "@/components/module-page-host";

/**
 * The module's home in the panel: `/panel/<key>` (D27). It renders the overview
 * declared in the manifest; a module without one falls back to its settings.
 */
export const instant = false;

export default async function ModuleWorkspacePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  return <ModulePageHost moduleKey={module} route="overview" />;
}
