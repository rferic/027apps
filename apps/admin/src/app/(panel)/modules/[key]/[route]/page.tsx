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
 * Host for the pages a module ships (`/modules/<key>/<route>`).
 *
 * Three gates before rendering: the manifest must declare the route, the
 * module must be `active`, and the page's role must reach the caller. The
 * component comes from the static registry, never from a path built with the
 * route params. An unknown route, an inactive module and a missing component
 * are the same 404: nothing about the package leaks to the client.
 */
export const instant = false;

/** A missing manifest, an undeclared route and an unknown module are one 404. */
async function resolvePage(key: string, route: string) {
  const manifest = await loadModuleManifest(key);
  const page = manifest?.admin_pages.find((candidate) => candidate.route === route);
  if (!page) notFound();
  const detail = await loadModuleDetail(key);
  if (!detail.ok) notFound();
  return { page, detail };
}

export default async function ModuleAdminPage({
  params,
}: {
  params: Promise<{ key: string; route: string }>;
}) {
  const gate = await requirePanel("admin");
  if ("denied" in gate) {
    const locale = panelLocale(gate.user);
    const messages = await loadPanelMessages(locale);
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { key, route } = await params;
  const { page, detail } = await resolvePage(key, route);
  // Installed but not active: there is nothing to render yet, and a 404 here
  // would look like a broken package. Send the admin to the page with the
  // Activate button instead.
  if (detail.module.state !== "active") {
    redirect(`/modules/${encodeURIComponent(key)}/settings`);
  }
  if (page.role === "super_admin" && gate.user.role !== "super_admin") {
    const locale = panelLocale(gate.user);
    const messages = await loadPanelMessages(locale);
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const Page = MODULE_PAGES[`${key}/${route}`];
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
          href={`/modules/${encodeURIComponent(key)}/settings`}
          className="inline-flex min-h-9 items-center rounded-control border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {messages["Settings"] ?? "Settings"}
        </Link>
      </div>
      <Page />
    </section>
  );
}
