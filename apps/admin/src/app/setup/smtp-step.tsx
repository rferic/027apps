"use client";

import { useState } from "react";
import { DEFAULT_MESSAGES } from "@027apps/core/errors.js";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { confirmSmtpAction } from "./actions";

function apiError(message: string | undefined, messages: TranslationMap): string {
  if (message && Object.values(DEFAULT_MESSAGES).includes(message)) return t(message, messages);
  const fallback = t("We couldn't send the test email. Try again.", messages);
  return message ? `${fallback} ${t("Details: {message}", messages, { message })}` : fallback;
}

/**
 * Setup step 3: proves the project's SMTP works by mailing the super_admin's
 * own address (the destination is fixed server-side). The user confirms receipt,
 * which unlocks step 4 for this session.
 */
export function SmtpStep({ email, messages }: { email: string; messages: TranslationMap }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSend = async () => {
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/v1/setup/test-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        setStatus("sent");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(apiError(body?.error?.message, messages));
    } catch {
      setError(t("We couldn't reach the server. Check the connection, then try again.", messages));
    }
    setStatus("idle");
  };

  return (
    <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">{t("Step 3 · Email", messages)}</h2>
      <p className="mt-1 mb-2 text-xs text-muted-foreground">
        {t(
          "We send a test email to {email} through your Supabase project's SMTP. Configure it in the Supabase dashboard if you have not yet (we recommend Resend or Brevo). You can send it up to 3 times per minute.",
          messages,
          { email },
        )}
      </p>
      <p className="mb-4 rounded-control border border-border px-2 py-1 text-xs text-muted-foreground">
        {t(
          "The message arrives with the subject “Reset your password”: that is the test. Send whatever you like back, but do not use the link — it would change your admin password. Running locally, Supabase captures mail in its own inbox viewer (Mailpit) instead of delivering it.",
          messages,
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onSend} disabled={status === "sending"}>
          {status === "sending" ? t("Sending…", messages) : t("Send test email", messages)}
        </Button>
        {status === "sent" && (
          <form action={confirmSmtpAction}>
            <Button type="submit" variant="secondary">
              {t("I received it", messages)}
            </Button>
          </form>
        )}
      </div>
      {status === "sent" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t(
            "Check the inbox (and spam) of {email}. Running locally, Supabase captures mail in its own inbox viewer (Mailpit) instead of delivering it. Nothing yet? Check the SMTP settings in Supabase.",
            messages,
            { email },
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
