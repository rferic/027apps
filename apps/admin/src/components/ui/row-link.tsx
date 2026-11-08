import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Classes of the primary link of a clickable row: the pseudo-element covers
 * the whole row, so every cell navigates without wrapping the cells in a link.
 *
 * The overlay needs a positioned ancestor. `relative` goes on the `<tr>` and
 * the table must use `border-separate border-spacing-0`, because with
 * `border-collapse: collapse` the row is not the containing block in Safari
 * and the clickable area shrinks back to the link text.
 */
export const stretchedLinkClass =
  "after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Classes of a `<tr>` whose cells lead to the row detail. */
export const clickableRowClass =
  "relative cursor-pointer transition-colors hover:bg-muted/40 focus-within:bg-muted/40";

export interface RowLinkProps {
  href: string;
  /** Accessible name when the visible text of the cell is not enough. */
  label?: string;
  className?: string;
  children: ReactNode;
}

/** The row link: a real anchor, so middle click and Cmd+click still work. */
export function RowLink({ href, label, className, children }: RowLinkProps) {
  return (
    <Link href={href} aria-label={label} className={cn(stretchedLinkClass, className)}>
      {children}
    </Link>
  );
}
