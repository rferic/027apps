"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import { createCategory } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { slugConflictError } from "@/lib/panel-errors";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
    <FormAlert
      message={t("We couldn't create the category.", messages)}
      code={error.code === "conflict" ? undefined : error.code}
      details={error.details?.formErrors}
      requestId={error.requestId}
      messages={messages}
    />
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

      <Dialog
        labelledBy="category-create-title"
        ref={dialogRef}
        onCancel={(event) => {
          // Escape must not dismiss the dialog while the request is in flight.
          if (saving) event.preventDefault();
        }}
        onBackdropClick={saving ? undefined : () => dialogRef.current?.close()}
      >
        <h2 id="category-create-title" className="text-sm font-semibold">
          {t("New category", messages)}
        </h2>
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          <FormField
            id="category-name"
            label={t("Name", messages)}
            hint={t("Use a name between 1 and 80 characters.", messages)}
            hintId="category-name-help"
            error={fieldErrors.name?.[0]}
            errorId="category-name-error"
          >
            <input
              id="category-name"
              name="name"
              type="text"
              required
              maxLength={80}
              {...fieldAria("name", fieldErrors.name?.[0], "category-name-help")}
              className={inputClass}
            />
          </FormField>

          <FormField
            id="category-slug"
            label={t("Slug", messages)}
            hint={t(
              "Lowercase letters, numbers and hyphens. Derived from the name when left empty.",
              messages,
            )}
            hintId="category-slug-help"
            error={slugError}
            errorId="category-slug-error"
          >
            <input
              id="category-slug"
              name="slug"
              type="text"
              maxLength={80}
              autoComplete="off"
              {...fieldAria("slug", slugError, "category-slug-help")}
              className={inputClass}
            />
          </FormField>

          {error && <CategoryFormError error={error} messages={messages} />}

          <FormActions>
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
          </FormActions>
        </form>
      </Dialog>
    </>
  );
}
