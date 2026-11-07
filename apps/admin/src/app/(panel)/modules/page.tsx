import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { modulesRoute } from "@027apps/core/modules/api.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The page refreshes/reads the Supabase session while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

/** Only the fields this page shows, taken from `listModules` (`ModuleView`). */
interface ModuleRow {
  key: string;
  name: string;
  version: string;
  state: string;
  is_public: boolean;
}

type Catalogue =
  | { ok: true; modules: ModuleRow[] }
  | { ok: false; code?: string; message?: string; requestId?: string };

type CatalogueErrorFields = Omit<Extract<Catalogue, { ok: false }>, "ok">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readModule(value: unknown): ModuleRow | null {
  if (!isRecord(value)) return null;
  const key = readString(value.key);
  const name = readString(value.name);
  const version = readString(value.version);
  const state = readString(value.state);
  if (!key || !name || !version || !state) return null;
  return { key, name, version, state, is_public: value.is_public === true };
}

/** Public envelope fields only: the API never returns internals here. */
function errorFields(value: unknown, headerRequestId?: string): CatalogueErrorFields {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  const code = readString(error.code);
  const message = readString(error.message);
  const requestId = readString(error.request_id) ?? headerRequestId;
  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

function readModules(value: unknown): ModuleRow[] | null {
  if (!isRecord(value) || !Array.isArray(value.modules)) return null;
  const modules: ModuleRow[] = [];
  for (const entry of value.modules) {
    const row = readModule(entry);
    // One malformed row invalidates the whole page: a partial table would look
    // complete while silently hiding modules.
    if (!row) return null;
    modules.push(row);
  }
  return modules;
}

/**
 * In-process call to `/api/v1/modules`: the page never builds a URL from the
 * client's `x-forwarded-host`/`host` (that would let a forged header send the
 * session elsewhere — SSRF + session exfiltration) and never leaves the
 * process. The access token travels as `Authorization: Bearer`, exactly as the
 * proxy would forward it, so the page still never reads the database for
 * catalogue content. Failures keep the envelope's public fields only.
 */
async function loadCatalogue(): Promise<Catalogue> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");

  let res: Response;
  try {
    res = await modulesRoute(await modulesRouteDeps())(
      // Fixed internal origin: nothing from the incoming request is trusted.
      new Request("http://panel.internal/api/v1/modules", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
  } catch {
    return { ok: false };
  }

  const headerRequestId = res.headers.get("x-request-id") ?? undefined;
  let body: unknown;
  try {
    body = JSON.parse(await res.text());
  } catch {
    return { ok: false, ...(headerRequestId ? { requestId: headerRequestId } : {}) };
  }

  if (!res.ok) return { ok: false, ...errorFields(body, headerRequestId) };

  const modules = readModules(body);
  if (!modules) return { ok: false };
  return { ok: true, modules };
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
      return t("Installed", messages);
  }
}

function publicLabel(isPublic: boolean, messages: TranslationMap): string {
  return isPublic ? t("Yes", messages) : t("No", messages);
}

function ModulesTable({
  modules,
  messages,
}: {
  modules: ModuleRow[];
  messages: TranslationMap;
}) {
  return (
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t("Modules", messages)}</caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Key", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("Version", messages)}
            </th>
            <th scope="col" className="py-2 pr-3 font-semibold">
              {t("State", messages)}
            </th>
            <th scope="col" className="py-2 font-semibold">
              {t("Public", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module.key} className="border-b border-border">
              <td className="py-2 pr-3 font-mono text-[11px]">{module.key}</td>
              <td className="py-2 pr-3 font-semibold">{module.name}</td>
              <td className="py-2 pr-3">{module.version}</td>
              <td className="py-2 pr-3">
                <Badge variant={stateVariant(module.state)}>
                  {stateLabel(module.state, messages)}
                </Badge>
              </td>
              <td className="py-2">{publicLabel(module.is_public, messages)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModulesCards({
  modules,
  messages,
}: {
  modules: ModuleRow[];
  messages: TranslationMap;
}) {
  return (
    <ul className="flex flex-col gap-2 sm:hidden">
      {modules.map((module) => (
        <li
          key={module.key}
          className="rounded-card border border-border bg-surface p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{module.name}</h2>
            <Badge variant={stateVariant(module.state)}>
              {stateLabel(module.state, messages)}
            </Badge>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{t("Key", messages)}</dt>
            <dd className="font-mono text-[11px]">{module.key}</dd>
            <dt className="text-muted-foreground">{t("Version", messages)}</dt>
            <dd>{module.version}</dd>
            <dt className="text-muted-foreground">{t("Public", messages)}</dt>
            <dd>{publicLabel(module.is_public, messages)}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Public error codes mapped to a readable message; unknown codes stay as-is. */
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
    default:
      return code;
  }
}

function CatalogueError({
  error,
  messages,
}: {
  error: CatalogueErrorFields;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-card border border-destructive bg-surface p-4 text-xs">
      <h2 className="text-sm font-semibold text-destructive">
        {t("We couldn't load the module catalogue.", messages)}
      </h2>
      {error.code && <p className="mt-2 text-muted-foreground">{errorCodeLabel(error.code, messages)}</p>}
      {error.message && (
        <p className="mt-1 text-muted-foreground">
          {t("Details: {message}", messages, { message: error.message })}
        </p>
      )}
      {error.requestId && (
        <p className="mt-2 text-muted-foreground">
          {t("Request ID", messages)}:{" "}
          <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
      <a href="/modules" className="mt-2 inline-block font-semibold text-accent hover:underline">
        {t("Try again", messages)}
      </a>
    </div>
  );
}

function CatalogueEmpty({ messages }: { messages: TranslationMap }) {
  return (
    <div className="rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("No modules are installed yet.", messages)}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("Install a module to make its features available to the instance.", messages)}
      </p>
    </div>
  );
}

function CatalogueList({
  modules,
  messages,
}: {
  modules: ModuleRow[];
  messages: TranslationMap;
}) {
  return (
    <>
      <ModulesTable modules={modules} messages={messages} />
      <ModulesCards modules={modules} messages={messages} />
    </>
  );
}

export default async function ModulesPage() {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const catalogue = await loadCatalogue();

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Modules", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("Modules installed on this instance. This page is read-only.", messages)}
        </p>
      </header>

      {catalogue.ok ? (
        catalogue.modules.length === 0 ? (
          <CatalogueEmpty messages={messages} />
        ) : (
          <CatalogueList modules={catalogue.modules} messages={messages} />
        )
      ) : (
        <CatalogueError error={catalogue} messages={messages} />
      )}
    </section>
  );
}
