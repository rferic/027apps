import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { isEmailEnabled, getNotificationsConfig } from '@/lib/settings/notifications'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

let cachedTransporter: any = null // eslint-disable-line @typescript-eslint/no-explicit-any

/** Invalidates the cached SMTP transporter. Call after SMTP config changes. */
export function invalidateEmailTransporter(): void {
  if (cachedTransporter) {
    try { cachedTransporter.close() } catch { /* ignore */ }
    cachedTransporter = null
  }
}

/** Parameters for sending an email notification. */
interface SendEmailParams {
  /** Recipient email address */
  to: string
  /** Email subject line */
  subject: string
  /** HTML body content */
  html: string
}

/**
 * Sends an email notification using the configured provider.
 *
 * Provider selection order:
 * 1. Custom SMTP (if configured in admin notification settings)
 * 2. Resend (if RESEND_API_KEY is set)
 *
 * Falls back silently if no provider is configured.
 * Reuses a pooled SMTP transporter for efficiency.
 *
 * @param params - Email content and recipient
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const enabled = await isEmailEnabled()
  if (!enabled) {
    console.log(`[Email] Disabled globally — skipping: "${subject}"`)
    return
  }

  const config = await getNotificationsConfig()

  // Use custom SMTP if configured
  if (config.smtp) {
    try {
      if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
          tls: { rejectUnauthorized: false },
          pool: true,
        })
      }

      await cachedTransporter!.sendMail({
        from: config.smtp.from_name
          ? `"${config.smtp.from_name}" <${config.smtp.from_email}>`
          : config.smtp.from_email,
        to,
        subject,
        html,
      })
      return
    } catch (err) {
      console.error('[Email] SMTP send failed, falling back to Resend:', err)
      // Fall through to Resend
    }
  }

  // Fallback to Resend
  if (!resend) {
    console.warn('[Email] No email provider configured (no SMTP, no RESEND_API_KEY)')
    return
  }

  try {
    const { error } = await resend.emails.send({
      from: '027Apps <notifications@027apps.com>',
      to,
      subject,
      html,
    })
    if (error) console.error('[Email] Resend send failed:', error)
  } catch (err) {
    console.error('[Email] Resend error:', err)
  }
}
