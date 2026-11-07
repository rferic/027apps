"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { memberErrorCodeLabel } from "@/lib/member-errors";
import { deactivationCopy } from "@/lib/member-form";
import { deactivateMember, type MutationResult } from "@/lib/member-mutations";

type DeleteFailure = Extract<MutationResult, { ok: false }>;

interface MemberDangerZoneProps {
  id: string;
  name: string;
  /** Self-deactivation is rejected by the API: never offer it here either. */
  isSelf: boolean;
  messages: TranslationMap;
}

/**
 * Destructive action kept apart from the primary save (§6). A native
 * `<dialog>` supplies focus trap, Escape and the top layer without a
 * dependency; the copy names the member and the consequence.
 */
export function MemberDangerZone({ id, name, isSelf, messages }: MemberDangerZoneProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<DeleteFailure | null>(null);
  const copy = deactivationCopy(name, messages);

  if (isSelf) return null;

  async function handleDeactivate() {
    setDeleting(true);
    setError(null);
    const result = await deactivateMember(id);
    setDeleting(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    dialogRef.current?.close();
    router.push("/members");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="member-danger-title"
      className="flex max-w-md flex-col gap-2 rounded-card border border-destructive bg-surface p-4"
    >
      <h2 id="member-danger-title" className="text-sm font-semibold text-destructive">
        {t("Danger zone", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">{copy.consequence}</p>
      <Button
        type="button"
        variant="destructive"
        className="min-h-11"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {copy.trigger}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="member-deactivate-title"
        className="w-full max-w-md rounded-card border border-border bg-surface p-4 backdrop:bg-foreground/40"
      >
        <h2 id="member-deactivate-title" className="text-sm font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">{copy.consequence}</p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.note}</p>

        {error && (
          <div role="alert" className="mt-3 rounded-card border border-destructive p-3 text-xs">
            <p className="font-semibold text-destructive">
              {t("We couldn't deactivate this member.", messages)}
            </p>
            {error.code && (
              <p className="mt-1 text-muted-foreground">
                {memberErrorCodeLabel(error.code, messages)}
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
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => dialogRef.current?.close()}
            disabled={deleting}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={handleDeactivate}
            disabled={deleting}
          >
            {deleting ? t("Deactivating…", messages) : copy.confirm}
          </Button>
        </div>
      </dialog>
    </section>
  );
}
