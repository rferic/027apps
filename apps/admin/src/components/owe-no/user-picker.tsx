"use client";

import { useMemo, useState } from "react";
import type { AdminUserOption } from "@027apps/owe-no/domain/admin.js";

/**
 * Searchable account picker for the panel: typing filters the active accounts
 * and the chosen id travels as `user_id`. It replaces a select with every user
 * in the instance, which stops being usable after a few dozen accounts.
 */
export function OweUserPicker({
  options,
  placeholder,
  noAccountLabel,
}: {
  options: AdminUserOption[];
  placeholder: string;
  noAccountLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminUserOption | null>(null);
  const matches = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    if (wanted === "") return [];
    return options
      .filter((option) => option.display_name.toLowerCase().includes(wanted))
      .slice(0, 8);
  }, [options, query]);

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name="user_id" value={selected?.id ?? ""} />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
        }}
        placeholder={placeholder}
        autoCapitalize="words"
        className="min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground"
      />
      {selected ? (
        <span className="text-[11px] text-accent">{selected.display_name}</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">{noAccountLabel}</span>
      )}
      {matches.length > 0 ? (
        <ul className="flex flex-col rounded-control border border-border bg-surface">
          {matches.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(option);
                  setQuery(option.display_name);
                }}
                className="flex min-h-9 w-full items-center px-3 text-left text-xs hover:bg-muted"
              >
                {option.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
