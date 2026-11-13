import { ModulePageHost } from "@/components/module-page-host";

/**
 * Module entry (D20): the overview lives here, at the module's own URL, so the
 * address the admin shares is `/modules/<key>` and not a second segment. A
 * module without an overview falls back to its settings page inside the host.
 */
export const instant = false;

export default async function ModuleEntryPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <ModulePageHost moduleKey={key} route="overview" />;
}
