import { permanentRedirect } from "next/navigation";

/**
 * The module pages moved to `/panel/<key>/<route>` (D27). `settings` now lives
 * at the module card itself, so both old shapes redirect.
 */
export const instant = false;

export default async function LegacyModulePage({
  params,
}: {
  params: Promise<{ key: string; route: string }>;
}) {
  const { key, route } = await params;
  const moduleKey = encodeURIComponent(key);
  if (route === "settings") permanentRedirect(`/panel/modules/${moduleKey}`);
  permanentRedirect(`/panel/${moduleKey}/${encodeURIComponent(route)}`);
}
