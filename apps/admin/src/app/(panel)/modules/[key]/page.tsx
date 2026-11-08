import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@027apps/i18n/t.js";
import type { Locale, TranslationMap } from "@027apps/i18n/types.js";
import { ModuleActions } from "@/components/module-actions";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import {
  loadModuleDetail,
  loadModuleGrants,
  loadModuleSettings,
  type ModuleDetail,
  type ModuleGrants,
  type ModuleSetting,
} from "@/lib/panel-modules";

/**
 * The page reads the session, the module and its settings while rendering; the
 * layout's opt-out is not inherited, so this segment opts out of the static
 * shell too.
 */
export const instant = false;

function stateVariant(state: ModuleDetail["state"]): BadgeVariant {
  return state === "active" ? "success" : "neutral";
}

function stateLabel(state: ModuleDetail["state"], messages: TranslationMap): string {
  switch (state) {
    case "active":
      return t("Active", messages);
    case "disabled":
      return t("Disabled", messages);
    default:
      return t("Installed", messages);
  }
}

function exposureLabel(
  exposure: ModuleDetail["mcp_exposed"],
  messages: TranslationMap,
): string {
  switch (exposure) {
    case "read":
      return t("Read", messages);
    case "read_write":
      return t("Read and write", messages);
    default:
      return t("None", messages);
  }
}

/** A secret is never in the response: the table only knows it is set. */
function settingValue(setting: ModuleSetting, messages: TranslationMap): string {
  if (setting.is_secret) {
    return setting.configured ? t("Configured", messages) : t("Not configured", messages);
  }
  const value = setting.value;
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? "—";
}

function ModuleBreadcrumb({ name, messages }: { name: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/modules"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Modules", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

function ModuleHeader({ module, messages }: { module: ModuleDetail; messages: TranslationMap }) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="text-base font-bold">{module.name}</h1>
      <Badge variant={stateVariant(module.state)}>{stateLabel(module.state, messages)}</Badge>
      <Badge variant={module.is_public ? "success" : "neutral"}>
        {module.is_public ? t("Public", messages) : t("Private", messages)}
      </Badge>
    </header>
  );
}

function MetaItem({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-[11px]" : "text-xs"}>{children}</dd>
    </div>
  );
}

function ModuleDetails({
  module,
  locale,
  timeZone,
  messages,
}: {
  module: ModuleDetail;
  locale: Locale;
  timeZone: string;
  messages: TranslationMap;
}) {
  return (
    <section
      aria-labelledby="module-details-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-details-title" className="text-sm font-semibold">
        {t("Details", messages)}
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaItem label={t("Key", messages)} mono>
          {module.key}
        </MetaItem>
        <MetaItem label={t("Version", messages)}>{module.version}</MetaItem>
        <MetaItem label={t("Manifest digest", messages)} mono>
          {/* Visually clipped, complete in the tooltip and in the DOM. */}
          <span title={module.manifest_digest} className="block max-w-[14rem] truncate">
            {module.manifest_digest || "—"}
          </span>
        </MetaItem>
        <MetaItem label={t("Installed", messages)}>
          {formatDate(module.installed_at, { locale, timeZone })}
        </MetaItem>
        <MetaItem label={t("Updated", messages)}>
          {formatDate(module.updated_at, { locale, timeZone })}
        </MetaItem>
        <MetaItem label={t("MCP exposure", messages)}>
          {exposureLabel(module.mcp_exposed, messages)}
        </MetaItem>
      </dl>
    </section>
  );
}

function ModuleSettings({
  settings,
  messages,
}: {
  settings: ModuleSetting[];
  messages: TranslationMap;
}) {
  return (
    <section
      aria-labelledby="module-settings-title"
      className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-settings-title" className="text-sm font-semibold">
        {t("Settings", messages)}
      </h2>
      {settings.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("This module has no settings.", messages)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{t("Settings", messages)}</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {t("Key", messages)}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {t("Value", messages)}
                </th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <tr key={setting.key} className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="block font-semibold">{setting.label}</span>
                    <code className="font-mono text-[11px] text-muted-foreground">{setting.key}</code>
                  </th>
                  <td className="py-2 align-top">{settingValue(setting, messages)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const grantLinkClasses =
  "inline-flex min-h-7 items-center rounded-full border border-border bg-muted px-2.5 text-xs font-semibold text-foreground hover:bg-muted/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function ModuleGrants({ grants, messages }: { grants: ModuleGrants; messages: TranslationMap }) {
  const empty = grants.users.length === 0 && grants.categories.length === 0;
  return (
    <section
      aria-labelledby="module-grants-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="module-grants-title" className="text-sm font-semibold">
        {t("Grants", messages)}
      </h2>
      {empty ? (
        <p className="text-xs text-muted-foreground">{t("No access has been granted yet.", messages)}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("Users", messages)}</h3>
            {grants.users.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {grants.users.map((user) => (
                  <li key={user.id}>
                    <Link href={`/members/${user.id}`} className={grantLinkClasses}>
                      {user.display_name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground">{t("Categories", messages)}</h3>
            {grants.categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {grants.categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/categories/${category.id}`} className={grantLinkClasses}>
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { key } = await params;
  const detail = await loadModuleDetail(key);

  // A missing module is a real 404, before any settings or grants read.
  if (!detail.ok && detail.code === "not_found") notFound();

  if (!detail.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={detail}
          heading={t("We couldn't load this module.", messages)}
          retryHref={`/modules/${encodeURIComponent(key)}`}
          messages={messages}
        />
      </section>
    );
  }

  const [settings, grants] = await Promise.all([
    loadModuleSettings(key),
    loadModuleGrants(key),
  ]);

  const timeZone = await loadPanelTimeZone();
  const installedModule = detail.module;

  return (
    <section className="flex flex-col gap-5">
      <ModuleBreadcrumb name={installedModule.name} messages={messages} />
      <ModuleHeader module={installedModule} messages={messages} />
      <ModuleDetails
        module={installedModule}
        locale={locale}
        timeZone={timeZone}
        messages={messages}
      />

      {settings.ok ? (
        <ModuleSettings settings={settings.settings} messages={messages} />
      ) : (
        <PanelError
          error={settings}
          heading={t("We couldn't load the module settings.", messages)}
          retryHref={`/modules/${encodeURIComponent(key)}`}
          messages={messages}
        />
      )}

      {grants.ok ? (
        <ModuleGrants grants={grants.grants} messages={messages} />
      ) : (
        <PanelError
          error={grants}
          heading={t("We couldn't load the module grants.", messages)}
          retryHref={`/modules/${encodeURIComponent(key)}`}
          messages={messages}
        />
      )}

      <ModuleActions
        moduleKey={installedModule.key}
        name={installedModule.name}
        state={installedModule.state}
        canUninstall={gate.user.role === "super_admin"}
        messages={messages}
      />
    </section>
  );
}
