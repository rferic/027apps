import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const adminClient = createAdminClientUntyped()
  const { data, error } = await adminClient
    .from('todo_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError('QUERY_ERROR', error.message, 500)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('BAD_REQUEST', 'Missing id parameter', 400)

  const adminClient = createAdminClientUntyped()
  const { error } = await adminClient.from('todo_items').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)
  return new Response(null, { status: 204 })
}
