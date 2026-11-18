"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import {
  invitationLink,
  renewInvitation,
  type InvitationDelivery,
} from "@/lib/invitation-mutations";

function failureMessage(code: string | undefined, messages: TranslationMap): string {
  switch (code) {
    case "rate_limited":
      return t("Wait a moment before renewing.", messages);
    case "invitation_used":
      return t("This invitation was already redeemed.", messages);
    case "invitation_not_expired":
      return t("This invitation has not expired yet.", messages);
    case "not_found":
      return t("This invitation no longer exists.", messages);
    default:
      return t("We couldn't renew the invitation.", messages);
  }
}

/**
 * Expired-only action: rotate the token, reuse the original duration and send
 * the email. The previous link stops working, so it asks first; the new token
 * is shown once in case the email fails.
 */
export function InvitationRenew({
  id,
  publicUrl,
  messages,
}: {
  id: string;
  publicUrl: string | null;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<InvitationDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = token ? invitationLink(token, publicUrl) : null;

  async function run() {
    setBusy(true);
    setError(null);
    setToken(null);
    setEmail(null);
    setCopied(false);

    const result = await renewInvitation(id);
    setBusy(false);
    if (!result.ok) {
      setError(failureMessage(result.code, messages));
      return;
    }
    setToken(result.token);
    setEmail(result.email ?? null);
    setConfirming(false);
    // No `router.refresh()` here: the invitation is now `pending`, so the page
    // would unmount this section and throw away the only copy of the new link.
    // The "done" action below refreshes once the admin has taken it.
  }

  async function copy() {
    if (!link) return;
    setCopied(await copyText(link));
  }

  return (
    <section
      aria-labelledby="invitation-renew-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="invitation-renew-title" className="text-sm font-semibold">
        {t("Renew invitation", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "This invitation expired. Renew it to send a new link with the same duration; the previous link stops working.",
          messages,
        )}
      </p>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-card border border-destructive bg-surface p-3">
          <p role="alert" className="text-xs font-semibold text-destructive">
            {t("The previous link will stop working. Continue?", messages)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => setConfirming(false)}>
              {t("Cancel", messages)}
            </Button>
            <Button variant="primary" className="min-h-11" disabled={busy} onClick={run}>
              {busy ? t("Renewing…", messages) : t("Renew invitation", messages)}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" className="min-h-11" onClick={() => setConfirming(true)}>
          {t("Renew invitation", messages)}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      {link && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-card border border-border bg-muted p-3"
        >
          <p className="text-xs font-semibold">
            {email?.status === "sent"
              ? t("The invitation email was sent.", messages)
              : t("New link ready. Copy it now.", messages)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label={t("Invitation link", messages)}
              className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-background px-2.5 font-mono text-xs text-foreground"
            />
            <Button variant="secondary" className="min-h-11" onClick={copy}>
              {copied ? t("Copied.", messages) : t("Copy link", messages)}
            </Button>
          </div>
          {/* Refreshing is what removes this section (the invitation is pending
              again), so it waits until the admin says the link is safe. */}
          <Button
            variant="ghost"
            className="min-h-11 self-start"
            onClick={() => router.refresh()}
          >
            {t("Done", messages)}
          </Button>
        </div>
      )}
    </section>
  );
}
