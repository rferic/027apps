import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import {
  getNotificationsConfig,
  updateNotificationsConfig,
} from '@/lib/settings/notifications'
import { invalidateEmailTransporter } from '@/lib/email/send'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const config = await getNotificationsConfig()
  return apiOk({
    email_enabled: config.email_enabled,
    push_enabled: config.push_enabled,
    smtp: config.smtp
      ? {
          host: config.smtp.host,
          port: config.smtp.port,
          user: config.smtp.user,
          from_email: config.smtp.from_email,
          from_name: config.smtp.from_name,
          // pass is never returned (write-only)
        }
      : null,
  })
}

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: {
    email_enabled?: boolean
    push_enabled?: boolean
    smtp?: {
      host: string
      port: number
      user: string
      pass: string
      from_email: string
      from_name: string
    } | null
  }
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON', 400)
  }

  const { error } = await updateNotificationsConfig({
    email_enabled: body.email_enabled,
    push_enabled: body.push_enabled,
    smtp: body.smtp ?? undefined,
  })

  if (error) return apiError('UPDATE_FAILED', error, 500)
  invalidateEmailTransporter()
  return apiOk({ success: true })
}
