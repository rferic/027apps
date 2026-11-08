"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormAlert } from "@/components/ui/form";
import { revokeInvitation } from "@/lib/invitation-mutations";
import type { MutationFailure } from "@/lib/mutation-result";

interface RouterLike {
  push: (href: string) => void;
  refresh: () => void;
}

/** After a revoke: leave the current view when a target is given, then refresh. */
export async function completeRevoke(router: RouterLike, redirectTo?: string): Promise<void> {
  if (redirectTo) router.push(redirectTo);
  router.refresh();
}

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
  redirectTo,
  messages,
}: {
  id: string;
  name: string;
  email: string;
  /** Send the caller here after revoking; the detail page returns to the list. */
  redirectTo?: string;
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
    await completeRevoke(router, redirectTo);
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

      <Dialog
        labelledBy={`invitation-revoke-title-${id}`}
        ref={dialogRef}
        onCancel={(event) => {
          if (revoking) event.preventDefault();
        }}
        onBackdropClick={revoking ? undefined : () => dialogRef.current?.close()}
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
          <FormAlert
            className="mt-3"
            message={t("We couldn't revoke the invitation.", messages)}
            code={error.code}
            requestId={error.requestId}
            messages={messages}
          />
        )}

        <FormActions className="mt-3">
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
        </FormActions>
      </Dialog>
    </>
  );
}
