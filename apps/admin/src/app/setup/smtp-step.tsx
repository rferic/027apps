"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmSmtpAction } from "./actions";

const NETWORK_ERROR = "We couldn't reach the server. Check the connection, then try again.";

/**
 * Setup step 3: proves the project's SMTP works by mailing the super_admin's
 * own address (the destination is fixed server-side). The user confirms receipt,
 * which unlocks step 4 for this session.
 */
export function SmtpStep({ email }: { email: string }) {
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
      setError(body?.error?.message ?? "We couldn't send the test email. Try again.");
    } catch {
      setError(NETWORK_ERROR);
    }
    setStatus("idle");
  };

  return (
    <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
      <h2 className="text-sm font-semibold">Step 3 · Email</h2>
      <p className="mt-1 mb-2 text-xs text-muted-foreground">
        We send a test email to <span className="font-medium">{email}</span> through your Supabase
        project&apos;s SMTP. Configure it in the Supabase dashboard if you have not yet (we recommend
        Resend or Brevo). You can send it up to 3 times per minute.
      </p>
      <p className="mb-4 rounded-control border border-border px-2 py-1 text-xs text-muted-foreground">
        The message arrives with the subject <span className="font-medium">“Reset your password”</span>:
        that is the test. Send whatever you like back, but <span className="font-medium">do not use the
        link</span> — it would change your admin password. Running locally, Supabase captures mail in
        its own inbox viewer (Mailpit) instead of delivering it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onSend} disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send test email"}
        </Button>
        {status === "sent" && (
          <form action={confirmSmtpAction}>
            <Button type="submit" variant="secondary">
              I received it
            </Button>
          </form>
        )}
      </div>
      {status === "sent" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Check the inbox (and spam) of {email}. Running locally, Supabase captures mail in its own
          inbox viewer (Mailpit) instead of delivering it. Nothing yet? Check the SMTP settings in
          Supabase.
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
