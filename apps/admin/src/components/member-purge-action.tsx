"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert } from "@/components/ui/form";
import { panelErrorCodeLabel } from "@/lib/panel-errors";
import { canConfirmPurge, PURGE_REDIRECT, purgeCopy } from "@/lib/member-form";
import { purgeMember, type MutationResult } from "@/lib/member-mutations";

type PurgeFailure = Extract<MutationResult, { ok: false }>;

interface MemberPurgeActionProps {
  id: string;
  name: string;
  /** The API never deletes the caller's own account. */
  isSelf: boolean;
  messages: TranslationMap;
}

/**
 * Irreversible deletion, offered only next to a deactivated member. The API
 * already rejects an active profile; the UI keeps the destructive action
 * separate from Reactivate and makes the reader type the member's name before
 * the confirm button enables.
 */
export function MemberPurgeAction({ id, name, isSelf, messages }: MemberPurgeActionProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<PurgeFailure | null>(null);
  const copy = purgeCopy(name, messages);

  if (isSelf) return null;

  function reset() {
    if (deleting) return;
    setTyped("");
    setError(null);
  }

  async function handlePurge() {
    if (!canConfirmPurge(typed, name)) return;
    setDeleting(true);
    setError(null);
    const result = await purgeMember(id);
    setDeleting(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    dialogRef.current?.close();
    router.push(PURGE_REDIRECT);
    router.refresh();
  }

  return (
    <section
      aria-labelledby="member-purge-title"
      className="flex max-w-md flex-col gap-2 rounded-card border border-destructive bg-surface p-4"
    >
      <h2 id="member-purge-title" className="text-sm font-semibold text-destructive">
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
        labelledBy="member-purge-dialog-title"
        ref={dialogRef}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
        onClose={reset}
        onBackdropClick={deleting ? undefined : () => dialogRef.current?.close()}
      >
        <h2 id="member-purge-dialog-title" className="text-sm font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">{copy.consequence}</p>
        <p className="mt-1 text-xs font-semibold text-destructive">{copy.note}</p>

        <label
          htmlFor="member-purge-confirm"
          className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground"
        >
          {copy.prompt}
          <input
            id="member-purge-confirm"
            name="member-purge-confirm"
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="min-h-11 rounded-control border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>

        {error && (
          <FormAlert
            className="mt-3"
            message={t("We couldn't delete this member.", messages)}
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
            onClick={handlePurge}
            disabled={deleting || !canConfirmPurge(typed, name)}
          >
            {deleting ? t("Deleting…", messages) : copy.confirm}
          </Button>
        </FormActions>
      </Dialog>
    </section>
  );
}
