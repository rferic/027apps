import { cookies } from "next/headers";
import { DocumentLang } from "@/components/document-lang";
import { PanelForbidden } from "@/components/panel-forbidden";
import { PanelHeader } from "@/components/panel-header";
import { PanelMobileMenu } from "@/components/panel-mobile-menu";
import { PanelNav } from "@/components/panel-nav";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { loadPanelSettings } from "@/lib/panel-settings";
import { THEME_COOKIE, themeFromCookie } from "@/lib/theme";

/**
 * The panel reads the session, the role and the instance settings on every
 * request: it opts out of the static shell instead of being prerendered.
 */
export const instant = false;

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const theme = themeFromCookie(cookieStore.get(THEME_COOKIE)?.value);
  const messages = await loadPanelMessages(locale);
  if ("denied" in gate) {
    return (
      <>
        <PanelForbidden locale={locale} messages={messages} user={gate.user} standalone />
        <DocumentLang locale={locale} />
      </>
    );
  }

  const settings = await loadPanelSettings();
  const instanceName = typeof settings["instance.name"] === "string" ? settings["instance.name"] : "";
  const role = gate.user.role === "super_admin" ? "super_admin" : "admin";

  return (
    <div
      lang={locale}
      className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[220px_1fr]"
    >
      <aside className="hidden border-r border-border bg-muted p-3 lg:block">
        <PanelNav role={role} messages={messages} variant="sidebar" />
      </aside>
      <div className="flex min-w-0 flex-col">
        <PanelHeader
          user={gate.user}
          locale={locale}
          messages={messages}
          theme={theme}
          instanceName={instanceName}
          menu={<PanelMobileMenu role={role} messages={messages} />}
        />
        <main id="content" className="flex-1 p-4">
          {children}
        </main>
      </div>
      <DocumentLang locale={locale} />
    </div>
  );
}
