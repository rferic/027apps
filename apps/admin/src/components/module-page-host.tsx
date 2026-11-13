import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { panelLocale } from "@/lib/panel-locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadModuleDetail } from "@/lib/panel-modules";
import { loadModuleManifest } from "@/lib/module-manifests";
import { MODULE_PAGES } from "@/lib/module-pages";
import { PanelForbidden } from "@/components/panel-forbidden";

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
    if (route === "overview") redirect(`/modules/${encodeURIComponent(moduleKey)}/settings`);
    notFound();
  }
  const detail = await loadModuleDetail(moduleKey);
  if (!detail.ok) notFound();
  return { page, detail };
}

export async function ModulePageHost({
  moduleKey,
  route,
}: {
  moduleKey: string;
  route: string;
}) {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return renderForbidden(gate.user);

  const { page, detail } = await resolvePage(moduleKey, route);
  if (detail.module.state !== "active") {
    redirect(`/modules/${encodeURIComponent(moduleKey)}/settings`);
  }
  if (page.role === "super_admin" && gate.user.role !== "super_admin") {
    return renderForbidden(gate.user);
  }

  const Page = MODULE_PAGES[`${moduleKey}/${route}`];
  if (!Page) notFound();

  const messages = await loadPanelMessages(panelLocale(gate.user));
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav
          aria-label={messages["Breadcrumb"] ?? "Breadcrumb"}
          className="text-xs text-muted-foreground"
        >
          <span>Platform</span> / <span>Modules</span> /{" "}
          <span className="font-semibold text-foreground">{detail.module.name}</span>
        </nav>
        <Link
          href={`/modules/${encodeURIComponent(moduleKey)}/settings`}
          className="inline-flex min-h-9 items-center rounded-control border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {messages["Settings"] ?? "Settings"}
        </Link>
      </div>
      <Page />
    </section>
  );
}
