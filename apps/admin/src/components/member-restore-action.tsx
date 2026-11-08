"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert } from "@/components/ui/form";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import { restoreCopy } from "@/lib/member-form";
import { restoreMember, type MutationResult } from "@/lib/member-mutations";

type RestoreFailure = Extract<MutationResult, { ok: false }>;

interface MemberRestoreActionProps {
  id: string;
  name: string;
  messages: TranslationMap;
}

/**
 * Reversible counterpart of the danger zone: a soft-deactivated member gets a
 * primary "Reactivate member" action with a brief confirmation. On success the
 * page refreshes in place so the status badge flips to Active.
 */
export function MemberRestoreAction({ id, name, messages }: MemberRestoreActionProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<RestoreFailure | null>(null);
  const copy = restoreCopy(name, messages);

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    const result = await restoreMember(id);
    setRestoring(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    dialogRef.current?.close();
    router.refresh();
  }

  return (
    <section
      aria-labelledby="member-restore-title"
      className="flex max-w-md flex-col gap-2 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="member-restore-title" className="text-sm font-semibold">
        {t("Member access", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">{copy.consequence}</p>
      <Button
        type="button"
        variant="primary"
        className="min-h-11"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {copy.trigger}
      </Button>

      <Dialog
        labelledBy="member-restore-dialog-title"
        ref={dialogRef}
        onCancel={(event) => {
          if (restoring) event.preventDefault();
        }}
        onBackdropClick={restoring ? undefined : () => dialogRef.current?.close()}
      >
        <h2 id="member-restore-dialog-title" className="text-sm font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">{copy.consequence}</p>

        {error && (
          <FormAlert
            className="mt-3"
            message={t("We couldn't reactivate this member.", messages)}
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
            disabled={restoring}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            onClick={handleRestore}
            disabled={restoring}
          >
            {restoring ? t("Reactivating…", messages) : copy.confirm}
          </Button>
        </FormActions>
      </Dialog>
    </section>
  );
}
