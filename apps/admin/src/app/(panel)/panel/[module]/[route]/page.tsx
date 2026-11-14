import { redirect } from "next/navigation";
import { ModulePageHost } from "@/components/module-page-host";

/**
 * Every other page a module ships: `/panel/<key>/<route>` (D27). `overview` is
 * canonical at the module home, so the address redirects there instead of
 * rendering the same page twice.
 */
export const instant = false;

export default async function ModuleWorkspaceRoutePage({
  params,
}: {
  params: Promise<{ module: string; route: string }>;
}) {
  const { module, route } = await params;
  if (route === "overview") redirect(`/panel/${encodeURIComponent(module)}`);
  return <ModulePageHost moduleKey={module} route={route} />;
}
