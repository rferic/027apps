"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "@/lib/category-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

/**
 * Destructive action kept apart from the primary save (§6). The confirmation
 * names the category and the consequence. The API refuses to delete a category
 * that still has modules (their grants would lose their template), so the
 * control is disabled with the reason instead of offering a doomed request.
 */
export function CategoryDangerZone({
  id,
  name,
  hasModules,
  messages,
}: {
  id: string;
  name: string;
  hasModules: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteCategory(id);
    setDeleting(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    dialogRef.current?.close();
    router.push("/categories");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="category-danger-title"
      className="flex max-w-md flex-col gap-2 rounded-card border border-destructive bg-surface p-4"
    >
      <h2 id="category-danger-title" className="text-sm font-semibold text-destructive">
        {t("Danger zone", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {hasModules
          ? t("Remove the category modules before deleting the category.", messages)
          : t(
              "Deleting the category removes the label its members share. Their module access does not change.",
              messages,
            )}
      </p>
      <Button
        variant="destructive"
        className="min-h-11"
        disabled={hasModules}
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {t("Delete category", messages)}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="category-delete-title"
        onCancel={(event) => {
          // Escape must not dismiss the dialog while the request is in flight.
          if (deleting) event.preventDefault();
        }}
        className="w-full max-w-md rounded-card border border-border bg-surface p-4 backdrop:bg-foreground/40"
      >
        <h2 id="category-delete-title" className="text-sm font-semibold">
          {t("Delete {name}?", messages, { name })}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "The category and its member list will be deleted. Module access members already have does not change.",
            messages,
          )}
        </p>

        {error && (
          <div role="alert" className="mt-3 rounded-card border border-destructive p-3 text-xs">
            <p className="font-semibold text-destructive">
              {t("We couldn't delete the category.", messages)}
            </p>
            {error.code && (
              <p className="mt-1 text-muted-foreground">
                {panelErrorCodeLabel(error.code, messages)}
              </p>
            )}
            {error.requestId && (
              <p className="mt-1 text-muted-foreground">
                {t("Request ID", messages)}:{" "}
                <code className="select-all font-mono">{error.requestId}</code>
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            className="min-h-11"
            onClick={() => dialogRef.current?.close()}
            disabled={deleting}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? t("Deleting…", messages) : t("Delete category", messages)}
          </Button>
        </div>
      </dialog>
    </section>
  );
}
