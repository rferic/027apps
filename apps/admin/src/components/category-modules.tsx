"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PanelError } from "@/components/panel-error";
import { assignCategoryModule, unassignCategoryModule } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import type { CategoryFailure, ModuleChoice } from "@/lib/panel-categories";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

function ModuleAlert({
  title,
  error,
  messages,
}: {
  title: string;
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-card border border-destructive p-3 text-xs">
      <p className="font-semibold text-destructive">{title}</p>
      {error.code && (
        <p className="mt-1 text-muted-foreground">{panelErrorCodeLabel(error.code, messages)}</p>
      )}
      {error.requestId && (
        <p className="mt-1 text-muted-foreground">
          {t("Request ID", messages)}:{" "}
          <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

/**
 * Bulk module template. Assigning materialises `user_modules` for the current
 * members; removing the template never revokes a grant already materialised,
 * so the help text states that explicitly (Core service contract).
 */
export function CategoryModules({
  categoryId,
  assigned,
  available,
  catalogueFailure = null,
  retryHref,
  messages,
}: {
  categoryId: string;
  assigned: string[];
  available: ModuleChoice[];
  /** The module catalogue read failed; assignment controls are hidden. */
  catalogueFailure?: CategoryFailure | null;
  /** Reloads this page so the failed catalogue is read again. */
  retryHref: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<MutationFailure | null>(null);

  const names = new Map(available.map((module) => [module.key, module.name]));
  const assignable = available.filter((module) => !assigned.includes(module.key));

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const key = String(data.get("moduleKey") ?? "");
    if (!key) return;

    setAssigning(true);
    setError(null);
    const result = await assignCategoryModule(categoryId, key);
    setAssigning(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    router.refresh();
  }

  async function handleRemove(key: string) {
    setRemoving(key);
    setError(null);
    const result = await unassignCategoryModule(categoryId, key);
    setRemoving(null);
    if (!result.ok) {
      setError(result);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="category-modules-title" className="flex max-w-md flex-col gap-3">
      <h2 id="category-modules-title" className="text-sm font-semibold">
        {t("Modules", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "Assigning a module gives it to the current members. Removing it here does not revoke access members already have.",
          messages,
        )}
      </p>

      {assigned.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("No modules assigned yet.", messages)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assigned.map((key) => (
            <li
              key={key}
              className="flex min-h-11 items-center justify-between gap-3 rounded-control border border-border bg-surface px-3 py-1.5 text-xs"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{names.get(key) ?? key}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{key}</span>
              </span>
              <Button
                variant="secondary"
                className="min-h-11"
                aria-label={`${t("Remove", messages)} ${names.get(key) ?? key}`}
                onClick={() => handleRemove(key)}
                disabled={removing !== null}
              >
                {removing === key ? t("Removing…", messages) : t("Remove", messages)}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {catalogueFailure ? (
        <PanelError
          error={catalogueFailure}
          heading={t("We couldn't load the module catalogue.", messages)}
          retryHref={retryHref}
          messages={messages}
        />
      ) : assignable.length > 0 ? (
        <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-2">
          <label htmlFor="category-module-add" className="flex flex-col gap-1 text-xs font-semibold">
            {t("Assign module", messages)}
            <Select id="category-module-add" name="moduleKey" required>
              {assignable.map((module) => (
                <option key={module.key} value={module.key}>
                  {module.name} ({module.key})
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="primary" className="min-h-11" disabled={assigning}>
            {assigning ? t("Assigning…", messages) : t("Assign module", messages)}
          </Button>
        </form>
      ) : available.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("No modules are installed yet.", messages)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("Every installed module is already assigned to this category.", messages)}
        </p>
      )}

      {error && (
        <ModuleAlert
          title={t("We couldn't update the category modules.", messages)}
          error={error}
          messages={messages}
        />
      )}
    </section>
  );
}
