import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { modulesRoute } from "@027apps/core/modules/api.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { PanelForbidden } from "@/components/panel-forbidden";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { FilterSelect } from "@/components/ui/filter-select";
import { RowLink, clickableRowClass } from "@/components/ui/row-link";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import { modulesRouteDeps } from "@/lib/modules-route-deps";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";
import {
  firstParam,
  PANEL_PAGE_SIZE,
  pageCount,
  pageHref,
  pageOffset,
  parsePage,
} from "@/lib/panel-pagination";
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
  | { ok: true; modules: ModuleRow[]; total: number }
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

function readCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseCatalogue(body: unknown): Catalogue | null {
  if (!isRecord(body)) return null;
  const modules = readModules(body);
  const total = readCount(body.total);
  if (!modules || total === null) return null;
  return { ok: true, modules, total };
}

/**
 * In-process call to `/api/v1/modules`: the page never builds a URL from the
 * client's `x-forwarded-host`/`host` (that would let a forged header send the
 * session elsewhere — SSRF + session exfiltration) and never leaves the
 * process. The access token travels as `Authorization: Bearer`, exactly as the
 * proxy would forward it, so the page still never reads the database for
 * catalogue content. Failures keep the envelope's public fields only.
 */
async function loadCatalogue(input: { offset: number }): Promise<Catalogue> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/login");

  const params = new URLSearchParams();
  params.set("limit", String(PANEL_PAGE_SIZE));
  params.set("offset", String(Math.max(0, input.offset)));

  let res: Response;
  try {
    res = await modulesRoute(await modulesRouteDeps())(
      // Fixed internal origin: nothing from the incoming request is trusted.
      new Request(`http://panel.internal/api/v1/modules?${params.toString()}`, {
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

  return parseCatalogue(body) ?? { ok: false };
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

type StateFilter = "all" | "installed" | "active" | "disabled";
type PublicFilter = "all" | "yes" | "no";

/** The catalogue defaults to the live state; installed/disabled stay opt-in. */
const DEFAULT_STATE: StateFilter = "active";

interface ModulesSearchParams {
  state?: string | string[];
  public?: string | string[];
  page?: string | string[];
}

function parseStateFilter(value: string | undefined): StateFilter {
  return value === "installed" || value === "active" || value === "disabled" || value === "all"
    ? value
    : DEFAULT_STATE;
}

/** The default `active` is omitted so the canonical URL stays clean. */
function stateParam(state: StateFilter): StateFilter | undefined {
  return state === DEFAULT_STATE ? undefined : state;
}

function parsePublicFilter(value: string | undefined): PublicFilter {
  return value === "yes" || value === "no" ? value : "all";
}

function filterModules(
  modules: ModuleRow[],
  state: StateFilter,
  visibility: PublicFilter,
): ModuleRow[] {
  return modules.filter((module) => {
    if (state !== "all" && module.state !== state) return false;
    if (visibility === "yes" && !module.is_public) return false;
    if (visibility === "no" && module.is_public) return false;
    return true;
  });
}

function ModulesFilter({
  state,
  visibility,
  messages,
}: {
  state: StateFilter;
  visibility: PublicFilter;
  messages: TranslationMap;
}) {
  const filtered = state !== DEFAULT_STATE || visibility !== "all";
  const params: Record<string, string> = {};
  const stateValue = stateParam(state);
  if (stateValue) params.state = stateValue;
  if (visibility !== "all") params.public = visibility;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        name="state"
        id="modules-state"
        label={t("State", messages)}
        value={state}
        basePath="/modules"
        params={params}
        options={[
          { value: "installed", label: t("Installed", messages) },
          { value: "active", label: t("Active", messages) },
          { value: "disabled", label: t("Disabled", messages) },
          // A real value: "All" is an explicit `state=all`, never a missing key.
          { value: "all", label: t("All", messages) },
        ]}
      />
      <FilterSelect
        name="public"
        id="modules-public"
        label={t("Public", messages)}
        value={visibility === "all" ? "" : visibility}
        basePath="/modules"
        params={params}
        options={[
          { value: "", label: t("All", messages) },
          { value: "yes", label: t("Yes", messages) },
          { value: "no", label: t("No", messages) },
        ]}
      />
      {filtered && (
        <Link
          href="/modules"
          className="min-h-11 py-3 text-xs font-semibold text-accent hover:underline"
        >
          {t("Clear filter", messages)}
        </Link>
      )}
    </div>
  );
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
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">{t("Modules", messages)}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Key", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Name", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("Version", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 pr-3 font-semibold">
              {t("State", messages)}
            </th>
            <th scope="col" className="border-b border-border py-2 font-semibold">
              {t("Public", messages)}
            </th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module.key} className={clickableRowClass}>
              <td className="border-b border-border py-2 pr-3 font-mono text-[11px]">{module.key}</td>
              <td className="border-b border-border py-2 pr-3 font-semibold">
                <RowLink
                  href={`/modules/${encodeURIComponent(module.key)}`}
                  label={module.name}
                  className="text-accent"
                >
                  {module.name}
                </RowLink>
              </td>
              <td className="border-b border-border py-2 pr-3">{module.version}</td>
              <td className="border-b border-border py-2 pr-3">
                <Badge variant={stateVariant(module.state)}>
                  {stateLabel(module.state, messages)}
                </Badge>
              </td>
              <td className="border-b border-border py-2">
                {publicLabel(module.is_public, messages)}
              </td>
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
        <li key={module.key}>
          <Link
            href={`/modules/${encodeURIComponent(module.key)}`}
            className="flex min-h-11 flex-col gap-1 rounded-card border border-border bg-surface p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{module.name}</span>
              <Badge variant={stateVariant(module.state)}>
                {stateLabel(module.state, messages)}
              </Badge>
            </span>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">{t("Key", messages)}</dt>
              <dd className="font-mono text-[11px]">{module.key}</dd>
              <dt className="text-muted-foreground">{t("Version", messages)}</dt>
              <dd>{module.version}</dd>
              <dt className="text-muted-foreground">{t("Public", messages)}</dt>
              <dd>{publicLabel(module.is_public, messages)}</dd>
            </dl>
          </Link>
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
      <Link href="/modules" className="mt-2 inline-block font-semibold text-accent hover:underline">
        {t("Try again", messages)}
      </Link>
    </div>
  );
}

function CatalogueEmpty({
  filtered,
  messages,
}: {
  filtered: boolean;
  messages: TranslationMap;
}) {
  if (filtered) {
    return (
      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">{t("No modules match this filter.", messages)}</h2>
        <Link
          href="/modules"
          className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
        >
          {t("Clear filter", messages)}
        </Link>
      </div>
    );
  }
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

function ModulesBody({
  catalogue,
  state,
  visibility,
  page,
  messages,
}: {
  catalogue: Catalogue;
  state: StateFilter;
  visibility: PublicFilter;
  page: number;
  messages: TranslationMap;
}) {
  if (!catalogue.ok) return <CatalogueError error={catalogue} messages={messages} />;

  const filters = {
    state: stateParam(state),
    public: visibility === "all" ? undefined : visibility,
  };
  const modules = filterModules(catalogue.modules, state, visibility);
  const filtered = state !== DEFAULT_STATE || visibility !== "all";

  return (
    <>
      <ModulesFilter state={state} visibility={visibility} messages={messages} />
      {catalogue.total === 0 || modules.length === 0 ? (
        <CatalogueEmpty filtered={filtered} messages={messages} />
      ) : (
        <CatalogueList modules={modules} messages={messages} />
      )}
      <Pagination
        page={page}
        pages={pageCount(catalogue.total)}
        hrefFor={(target) => pageHref("/modules", filters, target)}
        messages={messages}
      />
    </>
  );
}

export default async function ModulesPage({
  searchParams,
}: {
  searchParams?: Promise<ModulesSearchParams>;
} = {}) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const params = (await searchParams) ?? {};
  const state = parseStateFilter(firstParam(params.state));
  const visibility = parsePublicFilter(firstParam(params.public));
  const page = parsePage(firstParam(params.page));

  const catalogue = await loadCatalogue({ offset: pageOffset(page) });
  if (catalogue.ok && page > pageCount(catalogue.total)) {
    const target = pageCount(catalogue.total);
    redirect(
      pageHref(
        "/modules",
        {
          state: stateParam(state),
          public: visibility === "all" ? undefined : visibility,
        },
        target,
      ),
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-bold">{t("Modules", messages)}</h1>
        <p className="text-xs text-muted-foreground">
          {t("Modules installed on this instance. This page is read-only.", messages)}
        </p>
      </header>

      <ModulesBody
        catalogue={catalogue}
        state={state}
        visibility={visibility}
        page={page}
        messages={messages}
      />
    </section>
  );
}
