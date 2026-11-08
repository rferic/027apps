import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Native `<select>` with the shared control shape. The chevron is decorative
 * and only rendered for single selects: a multiple select shows a list box and
 * keeps its own keyboard and accessibility behaviour.
 */
const baseClasses =
  "h-9 min-h-11 w-full appearance-none rounded-control border border-border bg-background px-3 pr-8 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-h-10";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, multiple, ...rest }: SelectProps) {
  return (
    <span className="relative inline-flex min-w-0">
      <select multiple={multiple} className={cn(baseClasses, className)} {...rest}>
        {children}
      </select>
      {!multiple && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground"
        >
          <svg
            viewBox="0 0 12 8"
            className="h-2 w-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 1.5 6 6.5l5-5" />
          </svg>
        </span>
      )}
    </span>
  );
}
