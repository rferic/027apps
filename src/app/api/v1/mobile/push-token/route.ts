import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { createApiAdminClient } from '@/lib/supabase/api'

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth

  const { token, platform } = await req.json()

  if (!token || !platform) {
    return Response.json(
      { error: 'validation_error', message: 'token and platform are required' },
      { status: 400 }
    )
  }

  if (!['ios', 'android'].includes(platform)) {
    return Response.json(
      { error: 'validation_error', message: 'platform must be ios or android' },
      { status: 400 }
    )
  }

  const admin = createApiAdminClient()
  await admin.from('push_tokens').upsert({
    user_id: auth.userId!,
    group_id: auth.groupId!,
    token,
    platform,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id, token' })

  return new Response(null, { status: 204 })
}
