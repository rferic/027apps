import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export const GET = withTiming(async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const adminClient = createAdminClientUntyped()
  const { data, error } = await adminClient.from('groups').select('id, name').order('name')
  if (error) return apiError('QUERY_ERROR', error.message, 500)
  return apiOk(data ?? [])
})
