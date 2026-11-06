import { cookies } from "next/headers";
import { hasActiveSuperAdmin, isSetupIncomplete } from "@027apps/core/instance/api.js";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { getInfra } from "@/lib/api/door";
import { APP_NAME } from "@/lib/brand";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/** Reads the session and the instance state on every request (no static shell). */
export const instant = false;

interface InstanceStatus {
  variant: BadgeVariant;
  label: string;
}

function instanceStatus(installed: boolean, incomplete: boolean, messages: TranslationMap): InstanceStatus {
  if (!installed) return { variant: "neutral", label: t("Not installed", messages) };
  if (incomplete) return { variant: "destructive", label: t("Setup incomplete", messages) };
  return { variant: "success", label: t("Ready", messages) };
}

/**
 * Dashboard placeholder: identity, instance state and the real setup status.
 * KPIs, module cards and activity belong to task-06; nothing here is sample data.
 */
export default async function DashboardPage() {
  const gate = await requirePanel("admin");
  // The panel layout already renders the generic 403 for this case.
  if ("denied" in gate) return null;

  const { settingsDeps } = await getInfra();
  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);
  const settings = await readPublicSettings(settingsDeps);
  const instanceName = typeof settings["instance.name"] === "string" ? settings["instance.name"] : "";

  const installed = await hasActiveSuperAdmin(settingsDeps);
  const incomplete = await isSetupIncomplete(settingsDeps);
  const status = instanceStatus(installed, incomplete, messages);

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-bold">{instanceName.trim() || APP_NAME}</h1>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <h2 className="text-sm font-semibold">{t("Dashboard", messages)}</h2>
      {installed && !incomplete && (
        <p className="text-xs text-muted-foreground">{t("Your installation is ready.", messages)}</p>
      )}
    </section>
  );
}
