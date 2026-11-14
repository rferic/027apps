import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import { panelLocale } from "@/lib/panel-locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadModuleDetail } from "@/lib/panel-modules";
import { loadModuleManifest } from "@/lib/module-manifests";
import { loadModuleMessages } from "@/lib/module-messages";
import { MODULE_PAGES } from "@/lib/module-pages";
import { PanelForbidden } from "@/components/panel-forbidden";
import { getInfra } from "@/lib/api/door";
import type { ModulePageContext } from "@027apps/core/modules/pages.js";
import type { ModuleManifest } from "@027apps/core/modules/manifest.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

/**
 * Renders one page of a module.
 *
 * Three gates before rendering: the manifest must declare the route, the module
 * must be `active`, and the page's role must reach the caller. The component
 * comes from the static registry, never from a path built with the route
 * params. An unknown route and a missing component are the same 404; an
 * installed-but-inactive module goes to its settings, where it can be enabled.
 */
async function renderForbidden(user: Parameters<typeof panelLocale>[0]) {
  const locale = panelLocale(user);
  const messages = await loadPanelMessages(locale);
  return <PanelForbidden locale={locale} messages={messages} user={user} />;
}

/** The manifest must declare the route and the module must be installed. */
async function resolvePage(moduleKey: string, route: string) {
  const manifest = await loadModuleManifest(moduleKey);
  const page = manifest?.admin_pages.find((candidate) => candidate.route === route);
  if (!page) {
    // The module entry opens its overview; without one there is nothing to
    // show, so fall back to the page that can enable or configure it.
    if (route === "overview") redirect(`/panel/modules/${encodeURIComponent(moduleKey)}`);
    notFound();
  }
  const detail = await loadModuleDetail(moduleKey);
  if (!detail.ok) notFound();
  return { page, pages: manifest?.admin_pages ?? [], detail };
}

/**
 * The module's own pages, plus its settings, as tabs. The manifest decides
 * which pages exist and who may open them; a page the caller cannot reach is
 * not advertised. Overview lives at the module's own URL (D20).
 */
function ModuleNav({
  moduleKey,
  route,
  pages,
  role,
  messages,
  moduleMessages,
}: {
  moduleKey: string;
  route: string;
  pages: ModuleManifest["admin_pages"];
  role: "user" | "admin" | "super_admin";
  messages: TranslationMap;
  moduleMessages: Record<string, string>;
}) {
  const base = `/panel/${encodeURIComponent(moduleKey)}`;
  const entries = pages
    .filter((page) => page.role !== "super_admin" || role === "super_admin")
    .map((page) => ({
      route: page.route,
      label: t(page.label, moduleMessages),
      href: page.route === "overview" ? base : `${base}/${page.route}`,
    }));
  // Settings live on the module card in the catalogue, not in its workspace.
  entries.push({
    route: "settings",
    label: t("Settings", messages),
    href: `/panel/modules/${encodeURIComponent(moduleKey)}`,
  });

  return (
    <nav
      aria-label={t("Module pages", messages)}
      className="flex flex-wrap gap-1 border-b border-border pb-2"
    >
      {entries.map((entry) => {
        const current = entry.route === route;
        return (
          <Link
            key={entry.route}
            href={entry.href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-control px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              current
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

export async function ModulePageHost({
  moduleKey,
  route,
  searchParams = {},
}: {
  moduleKey: string;
  route: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return renderForbidden(gate.user);

  const { page, pages, detail } = await resolvePage(moduleKey, route);
  if (detail.module.state !== "active") {
    redirect(`/panel/modules/${encodeURIComponent(moduleKey)}`);
  }
  if (page.role === "super_admin" && gate.user.role !== "super_admin") {
    return renderForbidden(gate.user);
  }

  const Page = MODULE_PAGES[`${moduleKey}/${route}`];
  if (!Page) notFound();

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);
  const moduleMessages = await loadModuleMessages(moduleKey, locale);
  // The page gets the platform connection and the caller the gates approved;
  // it reuses the module's service instead of calling its own API over HTTP.
  const { settingsDeps } = await getInfra();
  const context: ModulePageContext = {
    moduleKey,
    caller: { kind: "session", userId: gate.user.id, role: gate.user.role },
    db: settingsDeps.db,
    locale,
    messages: moduleMessages,
    searchParams,
  };
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
          <Link
            href="/panel"
            className="hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("Platform", messages)}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link
            href={`/panel/${encodeURIComponent(moduleKey)}`}
            className="hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {detail.module.name}
          </Link>
          {route === "overview" ? null : (
            <>
              <span aria-hidden="true"> / </span>
              <span className="font-semibold text-foreground">
                {t(page.label, moduleMessages)}
              </span>
            </>
          )}
        </nav>
      </div>
      <ModuleNav
        moduleKey={moduleKey}
        route={route}
        pages={pages}
        role={gate.user.role}
        messages={messages}
        moduleMessages={moduleMessages}
      />
      <Page context={context} />
    </section>
  );
}
