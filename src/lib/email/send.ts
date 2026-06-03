import nodemailer from 'nodemailer'
import { Resend } from 'resend'

type SendParams = {
  to: string
  subject: string
  html: string
}

type SendResult = { error: string | null }

function getTransporter() {
  return nodemailer.createTransport({
    host: '127.0.0.1',
    port: 54325,
    ignoreTLS: true,
  })
}

let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('Missing RESEND_API_KEY')
    resendClient = new Resend(key)
  }
  return resendClient
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !port || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendEmail({ to, subject, html }: SendParams): Promise<SendResult> {
  const isDev = process.env.NODE_ENV === 'development'

  // 1. Local SMTP (Supabase Inbucket en desarrollo)
  if (isDev) {
    try {
      const transporter = getTransporter()
      await transporter.sendMail({
        from: '"027Apps" <noreply@027apps.local>',
        to,
        subject,
        html,
      })
      return { error: null }
    } catch {
      return { error: 'Could not send email. Please try again later.' }
    }
  }

  // 2. Resend (si está configurado)
  const key = process.env.RESEND_API_KEY
  if (key && process.env.SENDER_EMAIL) {
    try {
      const resend = getResend()
      const from = process.env.SENDER_EMAIL
      console.log(`[email] Sending via Resend to ${to} from ${from} subject="${subject}"`)
      const result = await resend.emails.send({ from, to, subject, html })
      console.log(`[email] Sent ok:`, JSON.stringify(result))
      return { error: null }
    } catch (err) {
      console.error(`[email] Resend failed:`, err)
      // Fall through to SMTP
    }
  }

  // 3. SMTP genérico (Gmail, etc.)
  const smtp = getSmtpTransporter()
  if (smtp) {
    try {
      const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@027apps.com'
      await smtp.sendMail({ from: `"027Apps" <${from}>`, to, subject, html })
      return { error: null }
    } catch (err) {
      console.error(`[email] SMTP failed:`, err)
      return { error: 'Could not send email. Please try again later.' }
    }
  }

  return { error: 'No email service configured. Set RESEND_API_KEY+SENDER_EMAIL or SMTP_* variables.' }
}
