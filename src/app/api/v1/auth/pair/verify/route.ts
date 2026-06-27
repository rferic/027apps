import type { NextRequest } from 'next/server'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { verifyPairingCode } from '@/lib/auth/pairing'

export async function POST(req: NextRequest) {
  let body: { session_id?: string; code?: string }
  try {
    body = await req.json()
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON', 400)
  }

  if (!body.session_id || !body.code) {
    return apiError('BAD_REQUEST', 'session_id and code are required', 400)
  }

  const db = createAdminClientUntyped()

  const { data } = await db
    .from('pairing_sessions')
    .select('id, user_id, secret, expires_at, used_at')
    .eq('id', body.session_id)
    .maybeSingle()

  if (!data) return apiError('NOT_FOUND', 'Session not found', 404)

  const session = data as { id: string; user_id: string; secret: string; expires_at: string; used_at: string | null }

  if (session.used_at) return apiError('ALREADY_USED', 'Session already used', 409)
  if (new Date(session.expires_at) < new Date()) return apiError('EXPIRED', 'Session expired', 410)

  if (!verifyPairingCode(session.secret, body.code)) {
    return apiError('INVALID_CODE', 'Invalid pairing code', 401)
  }

  await db.from('pairing_sessions').update({ used_at: new Date().toISOString() }).eq('id', body.session_id)

  const adminClient = createAdminClientUntyped()
  const { data: userData } = await adminClient.auth.admin.getUserById(session.user_id)
  const email = userData?.user ? (userData.user as { email?: string }).email?.toLowerCase() : null

  return apiOk({ success: true, user_id: session.user_id, email })
}
