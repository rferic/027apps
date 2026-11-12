import Link from "next/link";
import { panelLocale } from "@/lib/panel-locale";
import { notFound, redirect } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { ApiKeyEditForm } from "@/components/api-key-edit-form";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { apiKeyFingerprint } from "@/lib/api-key-edit";
import { formatDate } from "@/lib/format-date";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { loadPanelTimeZone } from "@/lib/panel-settings";
import { requirePanel } from "@/lib/panel-guard";
import { loadKey } from "@/lib/panel-keys";
import {
  loadModulesForOwner,
  modulesFailure,
  offeredModuleList,
} from "@/lib/panel-user-modules";
import { updateKeyAction } from "./actions";

/** The page reads the session and the key while rendering; opt out of the static shell. */
export const instant = false;

function EditBreadcrumb({ id, name, messages }: { id: string; name: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/keys"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("API keys", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <Link
        href={`/keys/${encodeURIComponent(id)}`}
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {name}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{t("Edit", messages)}</span>
    </nav>
  );
}

export default async function EditApiKeyPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requirePanel("super_admin");

  const locale = panelLocale(gate.user);
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { id } = await params;
  const result = await loadKey(id);

  // A missing key is a real 404, not a generic load error.
  if (!result.ok && result.code === "not_found") notFound();

  if (!result.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={result}
          heading={t("We couldn't load this API key.", messages)}
          retryHref={`/keys/${encodeURIComponent(id)}/edit`}
          messages={messages}
        />
      </section>
    );
  }

  const apiKey = result.apiKey;
  // Revocation is final: the detail page is the only read-only view for it.
  if (apiKey.revoked_at !== null) redirect(`/keys/${encodeURIComponent(id)}`);

  const timeZone = await loadPanelTimeZone();
  const currentLabel = apiKey.expiresAt
    ? formatDate(apiKey.expiresAt, { locale, timeZone })
    : "";

  // The owner's modules decide which module permissions the form may offer. A
  // refusal is shown, never hidden: silently rendering none would turn every
  // stored module permission into an immutable chip.
  const modules = await loadModulesForOwner(apiKey);
  const modulesError = modulesFailure(modules);

  if (modulesError) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={modulesError}
          heading={t("We couldn't load the owner's modules.", messages)}
          retryHref={`/keys/${encodeURIComponent(id)}/edit`}
          messages={messages}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <EditBreadcrumb id={apiKey.id} name={apiKey.name} messages={messages} />
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Edit API key", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("The kind, the owner and the role cap cannot be changed.", messages)}
        </p>
      </header>
      <ApiKeyEditForm
        key={apiKeyFingerprint(apiKey)}
        apiKey={apiKey}
        modules={offeredModuleList(modules)}
        action={updateKeyAction.bind(null, apiKey.id)}
        currentLabel={currentLabel}
        messages={messages}
      />
    </section>
  );
}
