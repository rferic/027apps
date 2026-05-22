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
    await resend.emails.send({
      from: '027Apps <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    return { error: null }
  } catch {
    return { error: 'Could not send email. Please try again later.' }
  }
}
