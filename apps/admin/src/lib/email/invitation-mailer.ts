import { buildInvitationEmail } from "@027apps/core/email/invitation.js";
import type { EmailMessage } from "@027apps/core/email/types.js";
import type {
  InvitationDelivery,
  InvitationsMailer,
} from "@027apps/core/invitations/api.js";
import { readPublicSettings } from "@027apps/core/settings/service.js";
import { getInfra } from "@/lib/api/door";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** A send must never hold the request open. */
const TIMEOUT_MS = 5_000;
const DEFAULT_FROM = "no-reply@mail.ericrf.com";

interface SendContext {
  publicUrl: string;
  instanceName: string;
  timeZone: string;
  inviterName: string;
}

/** `Nombre <direccion>` with the name stripped of header-breaking characters. */
function fromHeader(name: string, address: string): string {
  const safe = name.replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim();
  return `${safe || "027Apps"} <${address}>`;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

/** Instance identity plus the inviter's name, or the code that prevents sending. */
async function loadContext(invitationId: string): Promise<SendContext | { code: string }> {
  const { settingsDeps } = await getInfra();
  const settings = await readPublicSettings(settingsDeps);
  const publicUrl = readString(settings["instance.public_url"]);
  if (!publicUrl) return { code: "email_missing_public_url" };

  const instanceName = readString(settings["instance.name"]) ?? "027Apps";
  const { rows } = await settingsDeps.db.query(
    `select p.display_name
       from public.invitations i
       left join public.profiles p on p.id = i.created_by
      where i.id = $1`,
    [invitationId],
  );

  return {
    publicUrl,
    instanceName,
    timeZone: readString(settings["localization.timezone"]) ?? "UTC",
    inviterName: readString(rows[0]?.display_name) ?? instanceName,
  };
}

/** One POST to Resend; the provider body is never surfaced. */
async function postToResend(
  key: string,
  to: string,
  from: string,
  message: EmailMessage,
): Promise<InvitationDelivery> {
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
    return { status: "failed", code: isTimeout(error) ? "email_timeout" : "email_provider_error" };
  }
}

/**
 * Resend adapter for the invitation email. The API key is read at send time so
 * a missing secret degrades to "skipped" instead of breaking the invitation.
 */
export function createInvitationMailer(): InvitationsMailer {
  return {
    async sendInvitation({ invitation, token }): Promise<InvitationDelivery> {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { status: "skipped", code: "email_not_configured" };

      try {
        const context = await loadContext(invitation.id);
        if ("code" in context) return { status: "failed", code: context.code };

        const message = buildInvitationEmail({
          locale: invitation.locale,
          inviteeName: invitation.name,
          inviterName: context.inviterName,
          instanceName: context.instanceName,
          publicUrl: context.publicUrl,
          timeZone: context.timeZone,
          token,
          expiresAt: new Date(invitation.expires_at),
        });
        const from = fromHeader(
          process.env.EMAIL_FROM_NAME?.trim() || context.instanceName,
          process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        );
        return await postToResend(key, invitation.email, from, message);
      } catch (error) {
        return {
          status: "failed",
          code: isTimeout(error) ? "email_timeout" : "email_provider_error",
        };
      }
    },
  };
}
