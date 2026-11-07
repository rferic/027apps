import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";

export interface PaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total pages; the control stays visible when there is only one. */
  pages: number;
  hrefFor: (page: number) => string;
  messages: TranslationMap;
}

const linkClass =
  "inline-flex min-h-11 items-center rounded-control font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const disabledClass = "inline-flex min-h-11 items-center text-muted-foreground";

/**
 * Shared list pagination. Always rendered: a single page shows both arrows
 * disabled and "Page 1 of 1", so the control never disappears between pages.
 */
export function Pagination({ page, pages, hrefFor, messages }: PaginationProps) {
  const totalPages = Math.max(1, pages);
  const current = Math.min(Math.max(1, page), totalPages);
  const hasPrevious = current > 1;
  const hasNext = current < totalPages;

  return (
    <nav
      aria-label={t("Pagination", messages)}
      className="flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      {hasPrevious ? (
        <Link href={hrefFor(current - 1)} className={linkClass} rel="prev">
          {t("Previous", messages)}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t("Previous", messages)}
        </span>
      )}
      <span aria-current="page" className="text-muted-foreground">
        {t("Page {page} of {pages}", messages, { page: current, pages: totalPages })}
      </span>
      {hasNext ? (
        <Link href={hrefFor(current + 1)} className={linkClass} rel="next">
          {t("Next", messages)}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t("Next", messages)}
        </span>
      )}
    </nav>
  );
}
