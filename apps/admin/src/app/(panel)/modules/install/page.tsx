import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ModuleInstallButton } from "@/components/module-install-button";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { listModulePackages, type ModulePackage } from "@/lib/module-packages";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadModules, type ModuleDetail } from "@/lib/panel-modules";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page reads the session and the package directory while rendering; the
 * layout's opt-out is not inherited, so this segment opts out of the static
 * shell too.
 */
export const instant = false;

/** One page is enough to know what is already installed; the API caps it at 100. */
const INSTALLED_PAGE_LIMIT = 100;

function InstallBreadcrumb({ messages }: { messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/modules"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Modules", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{t("Install", messages)}</span>
    </nav>
  );
}

function invalidReason(pkg: ModulePackage, messages: TranslationMap): string {
  return pkg.reason === "key_mismatch"
    ? t("The package folder and the manifest key do not match.", messages)
    : t("This package's manifest is not valid.", messages);
}

/** Invalid packages stay visible but disabled with the reason the Core would reject them. */
function PackageActions({
  pkg,
  messages,
}: {
  pkg: ModulePackage;
  messages: TranslationMap;
}) {
  if (pkg.valid) return <ModuleInstallButton moduleKey={pkg.key} messages={messages} />;
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" className="min-h-11" disabled>
        {t("Install", messages)}
      </Button>
      <p className="text-xs text-muted-foreground">{invalidReason(pkg, messages)}</p>
    </div>
  );
}

function PackagesTable({
  packages,
  messages,
}: {
  packages: ModulePackage[];
  messages: TranslationMap;
}) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Install a module", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Key", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Version", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Description", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              <span className="sr-only">{t("Actions", messages)}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td className="border-b border-border py-2 pr-3 font-semibold">{pkg.name}</td>
              <td className="border-b border-border py-2 pr-3 font-mono text-[11px]">{pkg.key}</td>
              <td className="border-b border-border py-2 pr-3">{pkg.version}</td>
              <td className="border-b border-border py-2 pr-3">{pkg.description}</td>
              <td className="border-b border-border py-2">
                <PackageActions pkg={pkg} messages={messages} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PackagesCards({
  packages,
  messages,
}: {
  packages: ModulePackage[];
  messages: TranslationMap;
}) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {packages.map((pkg) => (
        <li
          key={pkg.id}
          className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{pkg.name}</span>
            <span className="text-xs text-muted-foreground">{pkg.version}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Key", messages)}</dt>
            <dd className="font-mono text-[11px]">{pkg.key}</dd>
            <dt className="text-muted-foreground">{t("Description", messages)}</dt>
            <dd>{pkg.description}</dd>
          </dl>
          <PackageActions pkg={pkg} messages={messages} />
        </li>
      ))}
    </ul>
  );
}

function PackagesEmpty({ messages }: { messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No packages are available to install.", messages)}</h2>
      <Link
        href="/modules"
        className="mt-2 inline-block text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Back to modules", messages)}
      </Link>
    </div>
  );
}

/** Packages already installed do not belong in the installer. */
function availablePackages(
  packages: ModulePackage[],
  installed: ModuleDetail[],
): ModulePackage[] {
  const installedKeys = new Set(installed.map((module) => module.key));
  // The folder is the package's identity: a manifest key is only a claim until it matches.
  return packages.filter((pkg) => !installedKeys.has(pkg.id));
}

export default async function InstallModulePage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const [packages, installed] = await Promise.all([
    listModulePackages(),
    loadModules({ offset: 0, limit: INSTALLED_PAGE_LIMIT }),
  ]);

  const available = installed.ok ? availablePackages(packages, installed.modules) : [];

  return (
    <section className="flex flex-col gap-4">
      <InstallBreadcrumb messages={messages} />
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Install a module", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("Only packages already present on the server can be installed.", messages)}
        </p>
      </header>

      {!installed.ok ? (
        <PanelError
          error={installed}
          heading={t("We couldn't load the module catalogue.", messages)}
          retryHref="/modules/install"
          messages={messages}
        />
      ) : available.length === 0 ? (
        <PackagesEmpty messages={messages} />
      ) : (
        <>
          <PackagesTable packages={available} messages={messages} />
          <PackagesCards packages={available} messages={messages} />
        </>
      )}
    </section>
  );
}
