import { redirect } from "next/navigation";
import { ModulePageHost } from "@/components/module-page-host";

/**
 * Every other page a module ships: `/modules/<key>/<route>`.
 *
 * `overview` is canonical at the module entry (`/modules/<key>`), so the old
 * address redirects there instead of rendering the same page twice.
 */
export const instant = false;

export default async function ModuleAdminPage({
  params,
}: {
  params: Promise<{ key: string; route: string }>;
}) {
  const { key, route } = await params;
  if (route === "overview") redirect(`/modules/${encodeURIComponent(key)}`);
  return <ModulePageHost moduleKey={key} route={route} />;
}
