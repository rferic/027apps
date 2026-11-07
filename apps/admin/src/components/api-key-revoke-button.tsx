"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeApiKey } from "@/lib/api-key-mutations";
import type { MutationFailure } from "@/lib/mutation-result";
import { panelErrorCodeLabel } from "@/lib/panel-errors";

/**
 * Revocation is immediate and irreversible, so the confirmation names the key
 * and its owner, states that every integration using it stops working, and
 * marks the caller's own key explicitly (revoking yourself is allowed as
 * self-service).
 */
export function ApiKeyRevokeButton({
  id,
  name,
  owner,
  isOwnKey,
  messages,
}: {
  id: string;
  name: string;
  /** Profile display name, or `null` for a service key owned by the instance. */
  owner: string | null;
  isOwnKey: boolean;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<MutationFailure | null>(null);

  async function handleRevoke() {
    setRevoking(true);
    setError(null);
    const result = await revokeApiKey(id);
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
        aria-label={t("Revoke the API key {name}", messages, { name })}
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {t("Revoke", messages)}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`api-key-revoke-title-${id}`}
        onCancel={(event) => {
          if (revoking) event.preventDefault();
        }}
        className="w-full max-w-md rounded-card border border-border bg-surface p-4 backdrop:bg-foreground/40"
      >
        <h2 id={`api-key-revoke-title-${id}`} className="text-sm font-semibold">
          {t("Revoke the API key {name}?", messages, { name })}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {owner === null
            ? t("This is an instance key.", messages)
            : t("This key belongs to {owner}.", messages, { owner })}
        </p>
        {isOwnKey && (
          <p className="mt-2 flex items-center gap-2 text-xs">
            <Badge variant="destructive">{t("This is your key", messages)}</Badge>
            <span className="text-muted-foreground">
              {t("You are revoking your own key.", messages)}
            </span>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Every integration that uses this key stops working immediately.", messages)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("This cannot be undone from this page.", messages)}
        </p>

        {error && (
          <div role="alert" className="mt-3 rounded-card border border-destructive p-3 text-xs">
            <p className="font-semibold text-destructive">
              {t("We couldn't revoke the API key.", messages)}
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
          <Button variant="destructive" className="min-h-11" onClick={handleRevoke} disabled={revoking}>
            {revoking ? t("Revoking…", messages) : t("Revoke key", messages)}
          </Button>
        </div>
      </dialog>
    </>
  );
}
