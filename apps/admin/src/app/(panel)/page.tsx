import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import {
  loadPanelDashboard,
  type DashboardFailure,
  type DashboardModule,
  type DashboardSuccess,
} from "@/lib/panel-dashboard";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The dashboard reads the session on every request; the layout's opt-out is
 * not inherited, so each segment opts out of the static shell on its own.
 */
export const instant = false;

function headline(dashboard: DashboardSuccess, messages: TranslationMap): string {
  if (dashboard.setupIncomplete) return t("Setup is incomplete.", messages);
  if (dashboard.health.status === "degraded") return t("The service is degraded.", messages);
  return t("Everything is ready.", messages);
}

/** Public health reasons mapped to readable text; unknown reasons stay visible. */
function healthReasonLabel(reason: string, messages: TranslationMap): string {
  switch (reason) {
    case "database_unreachable":
      return t("The database is unreachable.", messages);
    case "encryption_key_missing":
      return t(
        "The saved secrets cannot be decrypted because the encryption key is missing.",
        messages,
      );
    default:
      return t("Health check reported an unknown issue: {reason}", messages, { reason });
  }
}

function stateVariant(state: string): BadgeVariant {
  return state === "active" ? "success" : "neutral";
}

function stateLabel(state: string, messages: TranslationMap): string {
  switch (state) {
    case "active":
      return t("Active", messages);
    case "disabled":
      return t("Disabled", messages);
    default:
      return t("Unknown", messages);
  }
}

/** Public error codes mapped to a readable message; unknown codes keep the code as detail. */
function errorCodeLabel(code: string, messages: TranslationMap): string {
  switch (code) {
    case "internal":
      return t("Something went wrong on the server.", messages);
    case "insufficient_scope":
      return t("You do not have permission to do that.", messages);
    case "rate_limited":
      return t("Too many requests. Wait a moment and try again.", messages);
    case "not_found":
      return t("We could not find what you asked for.", messages);
    case "unauthorized":
      return t("Your session has expired. Sign in again.", messages);
    default:
      return t("Unexpected error: {code}", messages, { code });
  }
}

function DashboardError({
  error,
  messages,
}: {
  error: DashboardFailure;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-card border border-destructive bg-surface p-4 text-xs">
      <h1 className="text-sm font-semibold text-destructive">
        {t("We couldn't load the dashboard.", messages)}
      </h1>
      {error.code && (
        <p className="mt-2 text-muted-foreground">{errorCodeLabel(error.code, messages)}</p>
      )}
      {error.requestId && (
        <p className="mt-2 text-muted-foreground">
          {t("Request ID", messages)}:{" "}
          <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
      <Link href="/" className="mt-2 inline-block font-semibold text-accent hover:underline">
        {t("Try again", messages)}
      </Link>
    </div>
  );
}

function DashboardKpis({
  dashboard,
  messages,
}: {
  dashboard: DashboardSuccess;
  messages: TranslationMap;
}) {
  const kpis = [
    {
      label: t("Active members", messages),
      value: dashboard.kpis.activeMembers,
      source: t("Active profiles in this instance.", messages),
    },
    {
      label: t("Pending invitations", messages),
      value: dashboard.kpis.pendingInvitations,
      source: t("Invitations waiting to be redeemed.", messages),
    },
    {
      label: t("Active modules", messages),
      value: dashboard.kpis.activeModules,
      source: t("Modules installed and enabled.", messages),
    },
    {
      label: t("Categories", messages),
      value: dashboard.kpis.categories,
      source: t("Groups of members and module access.", messages),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-card border border-border bg-surface p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {kpi.label}
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold">{kpi.value}</dd>
          <dd className="mt-0.5 text-xs text-muted-foreground">{kpi.source}</dd>
        </div>
      ))}
    </dl>
  );
}

function ModuleCards({
  modules,
  messages,
}: {
  modules: DashboardModule[];
  messages: TranslationMap;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {modules.map((module) => (
        <li key={module.key}>
          <Link
            href="/modules"
            className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="text-sm font-semibold">{module.name}</span>
            <span className="flex flex-wrap items-center gap-1">
              <Badge variant={stateVariant(module.state)}>{stateLabel(module.state, messages)}</Badge>
              <Badge variant="neutral">
                {module.isPublic ? t("Public", messages) : t("Private", messages)}
              </Badge>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DashboardModules({
  modules,
  messages,
}: {
  modules: DashboardModule[];
  messages: TranslationMap;
}) {
  return (
    <section aria-labelledby="dashboard-modules" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-modules" className="text-sm font-semibold">
          {t("Modules", messages)}
        </h2>
        <Link href="/modules" className="text-xs font-semibold text-accent hover:underline">
          {t("View all modules", messages)}
        </Link>
      </div>
      {modules.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold">{t("No modules are installed yet.", messages)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("Install a module to make its features available to the instance.", messages)}
          </p>
          <Link href="/modules" className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
            {t("Install a module", messages)}
          </Link>
        </div>
      ) : (
        <ModuleCards modules={modules} messages={messages} />
      )}
    </section>
  );
}

function DashboardEmpty({ messages }: { messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No members or modules yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Invite members or install a module to get started.", messages)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-accent">
        <Link href="/invitations" className="hover:underline">
          {t("Invite members", messages)}
        </Link>
        <Link href="/modules" className="hover:underline">
          {t("Install a module", messages)}
        </Link>
      </div>
    </div>
  );
}

function DashboardBody({
  dashboard,
  messages,
}: {
  dashboard: DashboardSuccess;
  messages: TranslationMap;
}) {
  // Nothing to show only when the four KPIs that carry the next step are empty:
  // members, pending invitations, categories and modules.
  const isEmpty =
    dashboard.kpis.members === 0 &&
    dashboard.kpis.pendingInvitations === 0 &&
    dashboard.kpis.categories === 0 &&
    dashboard.modules.length === 0;

  return (
    <>
      {isEmpty ? (
        <DashboardEmpty messages={messages} />
      ) : (
        <DashboardKpis dashboard={dashboard} messages={messages} />
      )}
      {!isEmpty && <DashboardModules modules={dashboard.modules} messages={messages} />}
    </>
  );
}

/**
 * The header already carries the instance identity, so the page leads with the
 * real state and the action that resolves it. It never repeats the name.
 */
export default async function DashboardPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const dashboard = await loadPanelDashboard();

  if (!dashboard.ok) {
    return (
      <section className="flex flex-col gap-4">
        <DashboardError error={dashboard} messages={messages} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{headline(dashboard, messages)}</h1>
        {dashboard.setupIncomplete && (
          <Link href="/setup" className="text-xs font-semibold text-accent hover:underline">
            {t("Finish setup", messages)}
          </Link>
        )}
      </header>

      {dashboard.health.status === "degraded" && (
        <div role="status" className="rounded-card border border-destructive bg-surface p-4">
          <h2 className="text-sm font-semibold text-destructive">
            {t("What needs attention", messages)}
          </h2>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
            {dashboard.health.reasons.map((reason) => (
              <li key={reason}>{healthReasonLabel(reason, messages)}</li>
            ))}
          </ul>
        </div>
      )}

      <DashboardBody dashboard={dashboard} messages={messages} />
    </section>
  );
}
