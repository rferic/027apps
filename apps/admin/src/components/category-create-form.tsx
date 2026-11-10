"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { FormActions, FormAlert, FormField } from "@/components/ui/form";
import { createCategory } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { slugConflictError } from "@/lib/panel-errors";
import { useCreateForm } from "@/lib/use-create-form";

const inputClass =
  "min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const cancelClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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

/** Where the create form lands: the new detail, or the list without an id. */
export function categoryCreatedHref(id: string | undefined): string {
  return id ? `/categories/${encodeURIComponent(id)}` : "/categories";
}

/**
 * Create form on its own page (§6). On success the API returns the new id, so
 * the reader lands on the detail that still needs members or modules.
 */
export function CategoryCreateForm({ messages }: { messages: TranslationMap }) {
  const router = useRouter();
  const createForm = useCreateForm();
  const error = createForm.error;

  // A conflict on this form is always the slug: say so next to the field.
  const slugError = slugConflictError(error, messages) ?? createForm.fieldErrors.slug?.[0];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim();

    createForm.dispatch({ type: "submit" });
    const result = await createCategory({ name, ...(slug ? { slug } : {}) });

    if (!result.ok) {
      createForm.dispatch({
        type: "failed",
        error: result,
        fieldErrors: result.details?.fieldErrors ?? {},
      });
      return;
    }

    form.reset();
    router.push(categoryCreatedHref(result.id));
    router.refresh();
  }

  return (
    <form key={createForm.formKey} onSubmit={handleSubmit} className="flex w-full flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <FormField
        id="category-name"
        label={t("Name", messages)}
        hint={t("Use a name between 1 and 80 characters.", messages)}
        hintId="category-name-help"
        error={createForm.fieldErrors.name?.[0]}
        errorId="category-name-error"
      >
        <input
          id="category-name"
          name="name"
          type="text"
          required
          maxLength={80}
          {...fieldAria("name", createForm.fieldErrors.name?.[0], "category-name-help")}
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
        <Link href="/categories" className={cancelClass}>
          {t("Cancel", messages)}
        </Link>
        <Button type="submit" variant="primary" className="min-h-11" disabled={createForm.submitting}>
          {createForm.submitting ? t("Creating…", messages) : t("Create category", messages)}
        </Button>
      </FormActions>
    </form>
  );
}
