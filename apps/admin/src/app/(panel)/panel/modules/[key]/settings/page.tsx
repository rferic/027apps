import { permanentRedirect } from "next/navigation";

/**
 * The module card moved to `/panel/modules/<key>` (D27): the settings *are* the
 * card. This address stays as a 308 for links created before the move.
 */
export const instant = false;

export default async function LegacyModuleSettingsPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  permanentRedirect(`/panel/modules/${encodeURIComponent(key)}`);
}
