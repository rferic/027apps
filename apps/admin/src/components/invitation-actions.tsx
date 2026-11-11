"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import {
  regenerateInvitationLink,
  resendInvitationEmail,
  type InvitationDelivery,
} from "@/lib/invitation-mutations";

type Action = "resend" | "link";

function failureMessage(code: string | undefined, messages: TranslationMap): string {
  switch (code) {
    case "rate_limited":
      return t("Wait a moment before resending.", messages);
    case "invitation_expired":
      return t("This invitation has expired.", messages);
    case "invitation_used":
      return t("This invitation was already redeemed.", messages);
    case "not_found":
      return t("This invitation no longer exists.", messages);
    default:
      return t("We couldn't update the invitation.", messages);
  }
}

/**
 * Pending-only actions: send the email again or issue a new link. Both rotate
 * the token, so the previous link stops working; the link action asks first.
 */
export function InvitationActions({
  id,
  publicUrl,
  messages,
}: {
  id: string;
  /** `instance.public_url`; the link is built from it, never from the request. */
  publicUrl: string | null;
  messages: TranslationMap;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmLink, setConfirmLink] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<InvitationDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link =
    token && publicUrl ? `${publicUrl.replace(/\/+$/, "")}/invite/${encodeURIComponent(token)}` : token;

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    setToken(null);
    setEmail(null);
    setCopied(false);

    const result =
      action === "resend" ? await resendInvitationEmail(id) : await regenerateInvitationLink(id);

    setBusy(null);
    if (!result.ok) {
      setError(failureMessage(result.code, messages));
      return;
    }
    setToken(result.token);
    setEmail(result.email ?? null);
    setConfirmLink(false);
    if (action === "resend") router.refresh();
  }

  async function copy() {
    if (!link) return;
    setCopied(await copyText(link));
  }

  return (
    <section
      aria-labelledby="invitation-email-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <h2 id="invitation-email-title" className="text-sm font-semibold">
        {t("Email", messages)}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "Resend the invitation or generate a new link if the invitee lost it. The previous link stops working.",
          messages,
        )}
      </p>

      {confirmLink ? (
        <div className="flex flex-col gap-2 rounded-card border border-destructive bg-surface p-3">
          <p role="alert" className="text-xs font-semibold text-destructive">
            {t("The previous link will stop working. Continue?", messages)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => setConfirmLink(false)}>
              {t("Cancel", messages)}
            </Button>
            <Button variant="primary" className="min-h-11" onClick={() => run("link")}>
              {t("Generate new link", messages)}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => run("resend")}
          >
            {busy === "resend" ? t("Sending…", messages) : t("Resend email", messages)}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy !== null}
            onClick={() => setConfirmLink(true)}
          >
            {t("Generate new link", messages)}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}

      {link && (
        <div role="status" className="flex flex-col gap-2 rounded-card border border-border bg-muted p-3">
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
        </div>
      )}
    </section>
  );
}
