import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id: userId } = await params

  const db = createAdminClientUntyped()
  const { data, error } = await db
    .from('push_tokens')
    .select('id, token, platform, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return apiError('QUERY_FAILED', error.message, 500)

  return apiOk({ tokens: data ?? [] })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id: userId } = await params

  const db = createAdminClientUntyped()

  // 1. Delete all push tokens
  const { error } = await db.from('push_tokens').delete().eq('user_id', userId)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  // 2. Invalidate auth sessions via Supabase Admin API
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceKey) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
        method: 'DELETE',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      })
    } catch (err) {
      console.error('[Admin] Failed to invalidate sessions:', err)
    }
  }

  return new Response(null, { status: 204 })
}
