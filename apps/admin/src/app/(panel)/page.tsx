import { cookies } from "next/headers";
import Link from "next/link";
import { hasActiveSuperAdmin, setupIncomplete } from "@027apps/core/instance/api.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { PanelForbidden } from "@/components/panel-forbidden";
import { getInfra } from "@/lib/api/door";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadPanelSettings } from "@/lib/panel-settings";

type InstanceStatus = "ready" | "incomplete" | "not-installed";

function instanceStatus(installed: boolean, incomplete: boolean): InstanceStatus {
  if (!installed) return "not-installed";
  return incomplete ? "incomplete" : "ready";
}

function statusLabel(status: InstanceStatus, messages: TranslationMap): string {
  switch (status) {
    case "ready":
      return t("Everything is ready.", messages);
    case "incomplete":
      return t("Setup is incomplete.", messages);
    default:
      return t("Not installed.", messages);
  }
}

/**
 * Dashboard placeholder: the header already carries the instance identity, so
 * the page leads with the real state instead of repeating the name.
 */
export default async function DashboardPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const settings = await loadPanelSettings();
  const { settingsDeps } = await getInfra();
  const installed = await hasActiveSuperAdmin(settingsDeps);
  const incomplete = setupIncomplete(settings);
  const status = instanceStatus(installed, incomplete);

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h1 className="text-base font-bold">{statusLabel(status, messages)}</h1>
      {status !== "ready" && (
        <Link href="/setup" className="text-xs font-semibold text-accent hover:underline">
          {t("Finish setup", messages)}
        </Link>
      )}
    </section>
  );
}
