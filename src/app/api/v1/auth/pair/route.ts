import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { generateSecret, generatePairingCode } from '@/lib/auth/pairing'

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const secret = generateSecret()
  const db = createAdminClientUntyped()

  const { data, error } = await db
    .from('pairing_sessions')
    .insert({
      user_id: auth.userId!,
      secret,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (error) return apiError('CREATE_FAILED', error.message, 500)

  const row = data as { id: string; expires_at: string }
  const code = generatePairingCode(secret)

  return apiOk({
    session_id: row.id,
    code,
    qr_data: JSON.stringify({
      v: 1,
      s: row.id,
      u: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://027apps.com',
    }),
    expires_at: row.expires_at,
  })
}
