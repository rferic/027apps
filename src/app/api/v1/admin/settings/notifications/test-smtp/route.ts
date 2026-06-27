import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: {
    host: string
    port: number
    user: string
    pass: string
    from_email: string
  }
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON', 400)
  }

  if (!body.host || !body.port || !body.user || !body.pass || !body.from_email) {
    return apiError('VALIDATION_ERROR', 'All SMTP fields are required', 400)
  }

  try {
    const transporter = nodemailer.createTransport({
      host: body.host,
      port: body.port,
      secure: body.port === 465,
      auth: { user: body.user, pass: body.pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
    })

    await transporter.verify()
    return apiOk({ success: true, message: 'SMTP connection successful' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError('SMTP_TEST_FAILED', message, 400)
  }
}
