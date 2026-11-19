"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormActions, FormField } from "@/components/ui/form";
import { approveInvitationRequest, rejectInvitationRequest } from "@/lib/invitation-request-mutations";

/** Maps a mutation failure to a readable message; the resolved case is explicit. */
export function requestActionFailureMessage(
  code: string | undefined,
  messages: TranslationMap,
): string {
  switch (code) {
    case "request_resolved":
      return t("This request was already resolved.", messages);
    case "rate_limited":
      return t("Wait a moment before trying again.", messages);
    case "not_found":
      return t("This request no longer exists.", messages);
    default:
      return t("We couldn't update the request.", messages);
  }
}

/**
 * The approve/reject controls of one pending request (mockup "Solicitudes").
 * Approve opens a dialog whose seat amount defaults to the requested one;
 * reject asks for an optional reason. After either mutation the page refreshes
 * so the row leaves the pending list. A second click on an already-resolved
 * request surfaces `request_resolved` instead of granting twice.
 */
export function InvitationRequestActions({
  id,
  amount,
  messages,
}: {
  id: string;
  amount: number;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const approveRef = useRef<HTMLDialogElement>(null);
  const rejectRef = useRef<HTMLDialogElement>(null);
  const [approveAmount, setApproveAmount] = useState(amount);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const result = await approveInvitationRequest(id, approveAmount);
    setBusy(false);
    if (!result.ok) {
      setError(requestActionFailureMessage(result.code, messages));
      return;
    }
    approveRef.current?.close();
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const result = await rejectInvitationRequest(id, rejectReason.trim() || undefined);
    setBusy(false);
    if (!result.ok) {
      setError(requestActionFailureMessage(result.code, messages));
      return;
    }
    rejectRef.current?.close();
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          className="min-h-9"
          onClick={() => {
            setError(null);
            approveRef.current?.showModal();
          }}
        >
          {t("Approve", messages)}
        </Button>
        <Button
          variant="secondary"
          className="min-h-9"
          onClick={() => {
            setError(null);
            rejectRef.current?.showModal();
          }}
        >
          {t("Reject", messages)}
        </Button>
      </div>

      <Dialog
        labelledBy={`approve-title-${id}`}
        ref={approveRef}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onBackdropClick={busy ? undefined : () => approveRef.current?.close()}
      >
        <h2 id={`approve-title-${id}`} className="text-sm font-semibold">
          {t("Approve request", messages)}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Seats are added permanently and can be revoked. The level does not change.", messages)}
        </p>
        <div className="mt-3">
          <FormField id={`approve-amount-${id}`} label={t("Seats", messages)}>
            <input
              id={`approve-amount-${id}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={approveAmount}
              disabled={busy}
              onChange={(event) => setApproveAmount(Number(event.target.value))}
              className="min-h-11 rounded-control border border-border bg-background px-2.5 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm"
            />
          </FormField>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        <FormActions className="mt-3">
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={() => approveRef.current?.close()}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            variant="primary"
            className="min-h-11"
            disabled={busy}
            onClick={() => void approve()}
          >
            {t("Approve {amount} seat(s)", messages, { amount: approveAmount })}
          </Button>
        </FormActions>
      </Dialog>

      <Dialog
        labelledBy={`reject-title-${id}`}
        ref={rejectRef}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onBackdropClick={busy ? undefined : () => rejectRef.current?.close()}
      >
        <h2 id={`reject-title-${id}`} className="text-sm font-semibold">
          {t("Reject request", messages)}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("The requester sees the reason and can ask again later.", messages)}
        </p>
        <div className="mt-3">
          <FormField id={`reject-reason-${id}`} label={t("Reason (optional)", messages)}>
            <input
              id={`reject-reason-${id}`}
              type="text"
              value={rejectReason}
              disabled={busy}
              maxLength={280}
              onChange={(event) => setRejectReason(event.target.value)}
              className="min-h-11 rounded-control border border-border bg-background px-2.5 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-sm"
            />
          </FormField>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
            {error}
          </p>
        )}

        <FormActions className="mt-3">
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={() => rejectRef.current?.close()}
          >
            {t("Cancel", messages)}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={busy}
            onClick={() => void reject()}
          >
            {t("Reject", messages)}
          </Button>
        </FormActions>
      </Dialog>
    </>
  );
}
