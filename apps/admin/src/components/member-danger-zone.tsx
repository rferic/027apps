"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert } from "@/components/ui/form";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
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
      className="flex w-full flex-col gap-2 rounded-card border border-destructive bg-surface p-4"
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

      <Dialog
        labelledBy="member-deactivate-title"
        ref={dialogRef}
        onCancel={(event) => {
          // Escape must not dismiss the dialog while the request is in flight.
          if (deleting) event.preventDefault();
        }}
        onBackdropClick={deleting ? undefined : () => dialogRef.current?.close()}
      >
        <h2 id="member-deactivate-title" className="text-sm font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">{copy.consequence}</p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.note}</p>

        {error && (
          <FormAlert
            className="mt-3"
            message={t("We couldn't deactivate this member.", messages)}
            code={error.code}
            codeLabel={error.code ? panelErrorCodeLabel(error.code, messages) : undefined}
            requestId={error.requestId}
            messages={messages}
          />
        )}

        <FormActions className="mt-3">
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
        </FormActions>
      </Dialog>
    </section>
  );
}
