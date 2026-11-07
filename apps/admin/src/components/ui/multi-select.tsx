"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Secondary text: the code for currencies, an id for other lists. */
  hint?: string;
  /** Fixed values stay selected and have no remove button. */
  fixed?: boolean;
}

export interface MultiSelectProps {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  options: readonly MultiSelectOption[];
  values: readonly string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  /** The value whose PATCH is in flight; it renders dimmed. */
  pendingValue?: string | null;
  emptyLabel: string;
  messages: TranslationMap;
  disabled?: boolean;
  /** Starts with the listbox open; handy for previews and static tests. */
  initialOpen?: boolean;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Accent- and case-insensitive search used by the combobox. The hint is the
 * second matchable field, so a currency can be found by its ISO code.
 */
export function filterMultiSelectOptions(
  options: readonly MultiSelectOption[],
  query: string,
): MultiSelectOption[] {
  const needle = normalize(query);
  if (!needle) return [...options];
  return options.filter(
    (option) => normalize(option.label).includes(needle) || normalize(option.hint ?? "").includes(needle),
  );
}

/** Selected values that the bulk action may clear: never a fixed one. */
export function clearableValues(
  options: readonly MultiSelectOption[],
  values: readonly string[],
): string[] {
  const selected = new Set(values);
  return options
    .filter((option) => selected.has(option.value) && !option.fixed)
    .map((option) => option.value);
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 8"
      className="h-2 w-2.5 shrink-0 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 1.5 6 6.5l5-5" />
    </svg>
  );
}

function SelectedChips({
  selected,
  placeholder,
  messages,
  disabled,
  onToggle,
}: {
  selected: readonly MultiSelectOption[];
  placeholder: string;
  messages: TranslationMap;
  disabled: boolean;
  onToggle: (value: string) => void;
}) {
  if (selected.length === 0) {
    return <span className="text-muted-foreground">{placeholder}</span>;
  }

  return (
    <>
      {selected.map((option) => (
        <span
          key={option.value}
          data-fixed={option.fixed ? "true" : undefined}
          aria-disabled={option.fixed ? "true" : undefined}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm"
        >
          <span>{option.label}</span>
          {option.fixed ? null : (
            <button
              type="button"
              data-remove={option.value}
              aria-label={`${t("Remove", messages)} ${option.label}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(option.value);
              }}
              className="cursor-pointer rounded-full px-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </span>
      ))}
    </>
  );
}

function OptionList({
  options,
  values,
  activeIndex,
  pendingValue,
  emptyLabel,
  listId,
  labelId,
  optionId,
  onPick,
  onHover,
}: {
  options: readonly MultiSelectOption[];
  values: readonly string[];
  activeIndex: number;
  pendingValue: string | null;
  emptyLabel: string;
  listId: string;
  labelId: string;
  optionId: (index: number) => string;
  onPick: (option: MultiSelectOption) => void;
  onHover: (index: number) => void;
}) {
  if (options.length === 0) {
    return (
      <p role="status" className="p-3 text-xs text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul
      id={listId}
      role="listbox"
      aria-multiselectable="true"
      aria-labelledby={labelId}
      className="max-h-64 overflow-y-auto py-1"
    >
      {options.map((option, index) => {
        const isSelected = values.includes(option.value);
        const isPending = pendingValue === option.value;
        return (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            data-value={option.value}
            aria-selected={isSelected}
            aria-disabled={option.fixed || undefined}
            onMouseEnter={() => onHover(index)}
            onClick={() => onPick(option)}
            className={cn(
              "flex min-h-9 cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm",
              index === activeIndex && "bg-muted",
              option.fixed && "cursor-default",
              isPending && "opacity-60",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center",
                isSelected ? "text-accent" : "text-transparent",
              )}
            >
              <CheckIcon />
            </span>
            <span className="min-w-0 flex-1">{option.label}</span>
            {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Footer({
  selectedCount,
  total,
  removableCount,
  messages,
  onClear,
}: {
  selectedCount: number;
  total: number;
  removableCount: number;
  messages: TranslationMap;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-2">
      <p className="text-xs text-muted-foreground">
        {t("{selected} of {total} selected", messages, {
          selected: selectedCount,
          total,
        })}
      </p>
      <Button
        variant="ghost"
        className="min-h-9"
        disabled={removableCount === 0}
        onClick={onClear}
      >
        {t("Clear all except the default", messages)}
      </Button>
    </div>
  );
}

export function MultiSelect({
  label,
  placeholder,
  searchPlaceholder,
  options,
  values,
  onToggle,
  onClear,
  pendingValue = null,
  emptyLabel,
  messages,
  disabled = false,
  initialOpen = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(initialOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const baseId = useId().replace(/:/g, "");
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const selected = useMemo(() => {
    const chosen = new Set(values);
    return options.filter((option) => chosen.has(option.value));
  }, [options, values]);
  const filtered = useMemo(() => filterMultiSelectOptions(options, query), [options, query]);
  const removable = useMemo(() => clearableValues(options, values), [options, values]);
  const activeOption = filtered[activeIndex];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function openPanel() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function toggleOption(option: MultiSelectOption | undefined) {
    if (!option || option.fixed || disabled) return;
    onToggle(option.value);
  }

  function moveActive(delta: number) {
    if (filtered.length === 0) return;
    setActiveIndex((current) => (current + delta + filtered.length) % filtered.length);
  }

  const triggerActions: Record<string, () => void> = {
    ArrowDown: () => {
      if (open) moveActive(1);
      else openPanel();
    },
    ArrowUp: () => {
      if (open) moveActive(-1);
      else openPanel();
    },
    Enter: () => {
      if (open) toggleOption(activeOption);
      else openPanel();
    },
    " ": () => {
      if (open) toggleOption(activeOption);
      else openPanel();
    },
  };

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Chips own their keys; only events on the trigger itself are handled here.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Tab") {
      close(false);
      return;
    }
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      close(false);
      return;
    }
    const action = triggerActions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      toggleOption(activeOption);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === "Tab") close(false);
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span id={labelId} className="text-xs font-semibold">
        {label}
      </span>

      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          "flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-control border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <SelectedChips
          selected={selected}
          placeholder={placeholder}
          messages={messages}
          disabled={disabled}
          onToggle={onToggle}
        />
        <span className="ml-auto flex items-center pl-1">
          <ChevronIcon />
        </span>
      </div>

      {open && (
        <div className="absolute top-full z-20 mt-1 w-full rounded-card border border-border bg-surface text-foreground shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              aria-controls={listId}
              aria-activedescendant={activeOption ? optionId(activeIndex) : undefined}
              className="min-h-9 w-full rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>

          <OptionList
            options={filtered}
            values={values}
            activeIndex={activeIndex}
            pendingValue={pendingValue}
            emptyLabel={emptyLabel}
            listId={listId}
            labelId={labelId}
            optionId={optionId}
            onPick={toggleOption}
            onHover={setActiveIndex}
          />

          <Footer
            selectedCount={selected.length}
            total={options.length}
            removableCount={removable.length}
            messages={messages}
            onClear={() => {
              onClear();
              close(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
