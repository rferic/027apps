"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { filterHref, type FilterHrefInput } from "./filter-select";

/** Text is searched after the last keystroke, not on a button. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Query string for a list after typing in the search field. The value is
 * trimmed so a trailing space never reaches the URL; an empty search drops the
 * key and restarts the list at its first page, like any other filter.
 */
export function searchHref({ basePath, params, name, value }: FilterHrefInput): string {
  return filterHref({ basePath, params, name, value: value.trim() });
}

/** True only when the field differs from what the URL already applies. */
export function shouldSearch(next: string, current: string): boolean {
  return next.trim() !== current.trim();
}

export interface SearchInputProps {
  name: string;
  /** Search value currently applied by the URL. */
  value: string;
  basePath: string;
  /** The other filters to keep; `page` is always reset. */
  params: Record<string, string>;
  label: string;
  placeholder: string;
  messages: TranslationMap;
}

/**
 * Search field that navigates on its own, debounced: no submit button. Enter
 * applies at once, Escape clears. The list keeps its other filters and goes
 * back to the first page, exactly like the selects.
 */
export function SearchInput({
  name,
  value,
  basePath,
  params,
  label,
  placeholder,
  messages,
}: SearchInputProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest applied value, so the URL echoing our own navigation never
  // overwrites text typed after it started.
  const applied = useRef(value);
  // Keeps typing fluid: the field owns its text until the URL changes from
  // outside (back/forward, a clear link), which adopts the new value.
  const [text, setText] = useState(value);

  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    setText(value);
  }, [value]);

  function cancelTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function apply(next: string) {
    cancelTimer();
    if (!shouldSearch(next, applied.current)) return;
    const href = searchHref({ basePath, params, name, value: next });
    applied.current = next.trim();
    // `replace` keeps a single history entry per search. Next discards the
    // previous navigation as soon as a new one starts, so a superseded search
    // stops applying; there is no request of ours to abort because the rows
    // are rendered by the server.
    startTransition(() => {
      router.replace(href);
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setText(next);
    cancelTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      apply(next);
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      apply(text);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setText("");
      apply("");
    }
  }

  function clear() {
    setText("");
    apply("");
    input.current?.focus();
  }

  // A pending timer must not fire after the field is gone.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div role="search" className="flex flex-col gap-1 text-xs text-muted-foreground">
      <label htmlFor={id}>{label}</label>
      <span className="relative inline-flex min-w-0">
        <input
          ref={input}
          id={id}
          name={name}
          type="search"
          value={text}
          placeholder={placeholder}
          maxLength={100}
          autoComplete="off"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={cancelTimer}
          aria-busy={pending}
          className="min-h-11 w-full rounded-control border border-border bg-background px-2.5 pr-9 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:appearance-none"
        />
        {text && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("Clear search", messages)}
            className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </span>
    </div>
  );
}
