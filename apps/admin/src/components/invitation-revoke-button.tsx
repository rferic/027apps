"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/lib/invitation-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

/**
 * Revocation is destructive to the invitee's link, so the confirmation names
 * the person and the email and states that the link stops working at once.
 * Only pending invitations render this control: a used one cannot be revoked
 * and an already revoked one needs no second click.
 */
export function InvitationRevokeButton({
  id,
  name,
  email,
  messages,
}: {
  id: string;
  name: string;
  email: string;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    const result = await revokeInvitation(id);
    setRevoking(false);
    if (!result.ok) {
      setError(result);
      return;
    }
    dialogRef.current?.close();
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        className="min-h-11"
        aria-label={t("Revoke invitation for {name}", messages, { name })}
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {t("Revoke", messages)}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`invitation-revoke-title-${id}`}
        onCancel={(event) => {
          if (revoking) event.preventDefault();
        }}
        className="w-full max-w-md rounded-card border border-border bg-surface p-4 backdrop:bg-foreground/40"
      >
        <h2 id={`invitation-revoke-title-${id}`} className="text-sm font-semibold">
          {t("Revoke the invitation for {name}?", messages, { name })}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("The link for {email} stops working immediately.", messages, { email })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("This cannot be undone from this page.", messages)}
        </p>

        {error && (
          <div role="alert" className="mt-3 rounded-card border border-destructive p-3 text-xs">
            <p className="font-semibold text-destructive">
              {t("We couldn't revoke the invitation.", messages)}
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
            disabled={revoking}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={handleRevoke}
            disabled={revoking}
          >
            {revoking ? t("Revoking…", messages) : t("Revoke invitation", messages)}
          </Button>
        </div>
      </dialog>
    </>
  );
}
