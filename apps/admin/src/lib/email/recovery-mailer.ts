import { buildRecoveryEmail } from "@027apps/core/email/recovery.js";
import type { RecoveryMailer } from "@027apps/core/auth/password-recovery.js";
import type { EmailMessage } from "@027apps/core/email/types.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 5_000;
const DEFAULT_FROM = "no-reply@mail.ericrf.com";

function fromHeader(name: string, address: string): string {
  const safe = name.replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim();
  return `${safe || "027Apps"} <${address}>`;
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function post(
  key: string,
  to: string,
  from: string,
  message: EmailMessage,
): Promise<{ status: "sent" | "failed"; code?: string }> {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok
      ? { status: "sent" }
      : { status: "failed", code: "email_provider_error" };
  } catch (error) {
    return {
      status: "failed",
      code: isTimeout(error) ? "email_timeout" : "email_provider_error",
    };
  }
}

/** Resend adapter for the password-recovery email; missing key degrades to skipped. */
export function createRecoveryMailer(): RecoveryMailer {
  return {
    async send({ to, name, locale, link, instanceName }) {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { status: "skipped", code: "email_not_configured" };

      try {
        const publicUrl = new URL(link).origin;
        const message = buildRecoveryEmail({
          locale,
          name,
          instanceName,
          publicUrl,
          link,
        });
        const from = fromHeader(
          process.env.EMAIL_FROM_NAME?.trim() || instanceName,
          process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        );
        return await post(key, to, from, message);
      } catch (error) {
        return {
          status: "failed",
          code: isTimeout(error) ? "email_timeout" : "email_provider_error",
        };
      }
    },
  };
}
