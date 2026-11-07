"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ChangeEvent } from "react";
import { Select } from "./select";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterHrefInput {
  basePath: string;
  /** Filters currently applied to the list (`page` is ignored if present). */
  params: Record<string, string>;
  /** Query key the select controls. */
  name: string;
  /** New value; an empty string means "all" and drops the key. */
  value: string;
}

/**
 * Query string for a list after changing one select. The list restarts at its
 * first page, so `page` is always dropped; the other filters are kept; empty
 * values are omitted so the canonical URL stays clean.
 */
export function filterHref({ basePath, params, name, value }: FilterHrefInput): string {
  const query = new URLSearchParams();
  for (const [key, current] of Object.entries(params)) {
    if (key === "page" || key === name || !current) continue;
    query.set(key, current);
  }
  if (value) query.set(name, value);
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export interface FilterSelectProps {
  name: string;
  value: string;
  options: FilterOption[];
  basePath: string;
  params: Record<string, string>;
  label: string;
  /** Stable DOM id; generated when omitted. */
  id?: string;
}

/**
 * Filter `<select>` that applies its choice as soon as it changes, without a
 * submit button. `aria-busy` marks the list while the new URL is loading.
 */
export function FilterSelect({
  name,
  value,
  options,
  basePath,
  params,
  label,
  id: idProp,
}: FilterSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const generatedId = useId();
  const id = idProp ?? generatedId;
  // Keeps the choice on screen while the navigation is pending, and follows
  // the URL again when it changes from outside (back/forward, links).
  const [selected, setSelected] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setSelected(value);
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setSelected(next);
    const href = filterHref({ basePath, params, name, value: next });
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <label htmlFor={id} className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <Select
        id={id}
        name={name}
        value={selected}
        onChange={handleChange}
        aria-busy={pending}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
