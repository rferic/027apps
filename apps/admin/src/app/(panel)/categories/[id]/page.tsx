import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { CategoryDangerZone } from "@/components/category-danger-zone";
import { CategoryMembers } from "@/components/category-members";
import { CategoryModules } from "@/components/category-modules";
import { CategoryRenameForm } from "@/components/category-rename-form";
import { PanelError } from "@/components/panel-error";
import { PanelForbidden } from "@/components/panel-forbidden";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/locale";
import {
  loadCategory,
  loadMemberChoices,
  loadModuleChoices,
  MEMBER_CHOICES_LIMIT,
  type CategoryDetail,
  type MemberChoice,
  type ModuleChoice,
} from "@/lib/panel-categories";
import { loadPanelMessages } from "@/lib/panel-i18n";
import { requirePanel } from "@/lib/panel-guard";

/**
 * The page reads the session and the category while rendering; the layout's
 * opt-out is not inherited, so this segment opts out of the static shell too.
 */
export const instant = false;

interface CategorySearchParams {
  memberQ?: string | string[];
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Current page, so a failed secondary read can be retried without losing the search. */
function currentHref(id: string, query: string): string {
  const path = `/categories/${encodeURIComponent(id)}`;
  return query ? `${path}?memberQ=${encodeURIComponent(query)}` : path;
}

type MemberChoicesResult = Awaited<ReturnType<typeof loadMemberChoices>>;
type ModuleChoicesResult = Awaited<ReturnType<typeof loadModuleChoices>>;

function choicesOf(result: MemberChoicesResult): MemberChoice[] {
  return result.ok ? result.members : [];
}

function choicesTruncated(result: MemberChoicesResult): boolean {
  return result.ok && result.total > MEMBER_CHOICES_LIMIT;
}

function modulesOf(result: ModuleChoicesResult): ModuleChoice[] {
  return result.ok ? result.modules : [];
}

function CategoryBreadcrumb({ name, messages }: { name: string; messages: TranslationMap }) {
  return (
    <nav aria-label={t("Breadcrumb", messages)} className="text-xs text-muted-foreground">
      <Link
        href="/categories"
        className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {t("Categories", messages)}
      </Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

function CategoryHeader({
  category,
  messages,
}: {
  category: CategoryDetail;
  messages: TranslationMap;
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-base font-bold">{category.name}</h1>
      <p className="font-mono text-[11px] text-muted-foreground">{category.slug}</p>
      <p className="text-xs text-muted-foreground">
        {t("Members", messages)}: {category.member_count} · {t("Modules", messages)}:{" "}
        {category.modules.length}
      </p>
    </header>
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CategorySearchParams>;
}) {
  const gate = await requirePanel("admin");

  const cookieStore = await cookies();
  const locale = resolveLocale({ cookie: cookieStore.get(LOCALE_COOKIE)?.value });
  const messages = await loadPanelMessages(locale);

  // Generic refusal: it never reveals which routes or roles exist.
  if ("denied" in gate) {
    return <PanelForbidden locale={locale} messages={messages} user={gate.user} />;
  }

  const { id } = await params;
  const result = await loadCategory(id);

  // A missing category is a real 404, not a generic load error.
  if (!result.ok && result.code === "not_found") notFound();

  if (!result.ok) {
    return (
      <section className="flex flex-col gap-4">
        <PanelError
          error={result}
          heading={t("We couldn't load this category.", messages)}
          retryHref={`/categories/${encodeURIComponent(id)}`}
          messages={messages}
        />
      </section>
    );
  }

  const query = (first((await searchParams).memberQ) ?? "").trim().slice(0, 100);
  const [memberChoices, moduleChoices] = await Promise.all([
    loadMemberChoices(query ? { q: query } : {}),
    loadModuleChoices(),
  ]);

  const category = result.category;
  const retryHref = currentHref(category.id, query);
  return (
    <section className="flex flex-col gap-5">
      <CategoryBreadcrumb name={category.name} messages={messages} />
      <CategoryHeader category={category} messages={messages} />
      <CategoryRenameForm id={category.id} name={category.name} messages={messages} />
      <CategoryMembers
        categoryId={category.id}
        categoryName={category.name}
        members={category.members}
        choices={choicesOf(memberChoices)}
        memberQuery={query}
        truncated={choicesTruncated(memberChoices)}
        choicesFailure={memberChoices.ok ? null : memberChoices}
        retryHref={retryHref}
        messages={messages}
      />
      <CategoryModules
        categoryId={category.id}
        assigned={category.modules}
        available={modulesOf(moduleChoices)}
        catalogueFailure={moduleChoices.ok ? null : moduleChoices}
        retryHref={retryHref}
        messages={messages}
      />
      <CategoryDangerZone
        id={category.id}
        name={category.name}
        hasModules={category.modules.length > 0}
        messages={messages}
      />
    </section>
  );
}
