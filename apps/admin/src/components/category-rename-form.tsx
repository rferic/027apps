"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { renameCategory } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Small edit form (§6): label above, help below, error next to the field. */
export function CategoryRenameForm({
  id,
  name,
  messages,
}: {
  id: string;
  name: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setSaved(false);
    setError(null);
    setFieldError(undefined);

    const result = await renameCategory(id, String(data.get("name") ?? "").trim());
    setSaving(false);

    if (!result.ok) {
      setFieldError(result.details?.fieldErrors?.name?.[0]);
      setError(result);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
      <h2 className="text-sm font-semibold">{t("Rename category", messages)}</h2>
      <label htmlFor="category-rename" className="flex flex-col gap-1 text-xs font-semibold">
        {t("Name", messages)}
        <input
          id="category-rename"
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={name}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "category-name-error" : undefined}
          className={inputClass}
        />
      </label>
      {fieldError && (
        <p id="category-name-error" className="text-xs font-semibold text-destructive">
          {fieldError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" className="min-h-11" disabled={saving}>
          {saving ? t("Saving…", messages) : t("Save changes", messages)}
        </Button>
        {saved && (
          <p role="status" className="text-xs font-semibold text-success">
            {t("Changes saved.", messages)}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-card border border-destructive p-3 text-xs">
          <p className="font-semibold text-destructive">
            {t("We couldn't rename the category.", messages)}
          </p>
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
      )}
    </form>
  );
}
