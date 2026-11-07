"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { createCategory } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel, slugConflictError } from "@/lib/panel-errors";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-semibold text-destructive">
      {message}
    </p>
  );
}

function fieldAria(
  field: string,
  message: string | undefined,
  helpId?: string,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  const ids = [helpId, message ? `category-${field}-error` : undefined].filter(
    (id): id is string => Boolean(id),
  );
  return {
    "aria-invalid": message ? true : undefined,
    ...(ids.length > 0 ? { "aria-describedby": ids.join(" ") } : {}),
  };
}

function CategoryFormError({
  error,
  messages,
}: {
  error: MutationFailure;
  messages: TranslationMap;
}) {
  return (
    <div role="alert" className="rounded-card border border-destructive p-3 text-xs">
      <p className="font-semibold text-destructive">
        {t("We couldn't create the category.", messages)}
      </p>
      {error.code && error.code !== "conflict" && (
        <p className="mt-1 text-muted-foreground">{panelErrorCodeLabel(error.code, messages)}</p>
      )}
      {error.details?.formErrors?.map((message) => (
        <p key={message} className="mt-1 text-muted-foreground">
          {message}
        </p>
      ))}
      {error.requestId && (
        <p className="mt-1 text-muted-foreground">
          {t("Request ID", messages)}: <code className="select-all font-mono">{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

/**
 * Create action for the list (§6): a native `<dialog>` supplies the focus trap
 * and the top layer without a dependency. On success the API returns the new
 * id, so the reader lands on the detail that still needs members or modules.
 */
export function CategoryCreateForm({ messages }: { messages: TranslationMap }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // A conflict on this form is always the slug: say so next to the field.
  const slugError = slugConflictError(error, messages) ?? fieldErrors.slug?.[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim();

    setSaving(true);
    setError(null);
    setFieldErrors({});
    const result = await createCategory({ name, ...(slug ? { slug } : {}) });
    setSaving(false);

    if (!result.ok) {
      setFieldErrors(result.details?.fieldErrors ?? {});
      setError(result);
      return;
    }

    form.reset();
    dialogRef.current?.close();
    if (result.id) {
      router.push(`/categories/${encodeURIComponent(result.id)}`);
    }
    router.refresh();
  }

  return (
    <>
      <Button
        variant="primary"
        className="min-h-11"
        onClick={() => {
          setError(null);
          setFieldErrors({});
          dialogRef.current?.showModal();
        }}
      >
        {t("Create category", messages)}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="category-create-title"
        onCancel={(event) => {
          // Escape must not dismiss the dialog while the request is in flight.
          if (saving) event.preventDefault();
        }}
        className="w-full max-w-md rounded-card border border-border bg-surface p-4 backdrop:bg-foreground/40"
      >
        <h2 id="category-create-title" className="text-sm font-semibold">
          {t("New category", messages)}
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <label htmlFor="category-name" className="flex flex-col gap-1 text-xs font-semibold">
            {t("Name", messages)}
            <input
              id="category-name"
              name="name"
              type="text"
              required
              maxLength={80}
              {...fieldAria("name", fieldErrors.name?.[0], "category-name-help")}
              className={inputClass}
            />
          </label>
          <p id="category-name-help" className="text-xs text-muted-foreground">
            {t("Use a name between 1 and 80 characters.", messages)}
          </p>
          <FieldError id="category-name-error" message={fieldErrors.name?.[0]} />

          <label htmlFor="category-slug" className="flex flex-col gap-1 text-xs font-semibold">
            {t("Slug", messages)}
            <input
              id="category-slug"
              name="slug"
              type="text"
              maxLength={80}
              autoComplete="off"
              {...fieldAria("slug", slugError, "category-slug-help")}
              className={inputClass}
            />
          </label>
          <p id="category-slug-help" className="text-xs text-muted-foreground">
            {t(
              "Lowercase letters, numbers and hyphens. Derived from the name when left empty.",
              messages,
            )}
          </p>
          <FieldError id="category-slug-error" message={slugError} />

          {error && <CategoryFormError error={error} messages={messages} />}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => dialogRef.current?.close()}
              disabled={saving}
            >
              {t("Cancel", messages)}
            </Button>
            <Button type="submit" variant="primary" className="min-h-11" disabled={saving}>
              {saving ? t("Creating…", messages) : t("Create category", messages)}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
