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

export async function sendEmail({ to, subject, html }: SendParams): Promise<SendResult> {
  const isDev = process.env.NODE_ENV === 'development'

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

  const key = process.env.RESEND_API_KEY
  if (!key) return { error: 'Email service is not configured.' }

  try {
    const resend = getResend()
    const from = process.env.SENDER_EMAIL ?? '027Apps <onboarding@resend.dev>'
    console.log(`[email] Sending to ${to} from ${from} subject="${subject}"`)
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })
    console.log(`[email] Sent ok:`, JSON.stringify(result))
    return { error: null }
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err)
    return { error: 'Could not send email. Please try again later.' }
  }
}
