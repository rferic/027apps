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
    .from('todo_categories')
    .select('*')
    .order('display_order')
    .order('name')

  if (error) return apiError('QUERY_ERROR', error.message, 500)
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return apiError('VALIDATION_ERROR', 'Name is required', 400)

  const emoji = typeof body.emoji === 'string' ? body.emoji : '📌'
  const color = typeof body.color === 'string' ? body.color : '#6B7280'

  const adminClient = createAdminClientUntyped()
  const { data, error } = await adminClient
    .from('todo_categories')
    .insert({ name, emoji, color })
    .select()
    .single()

  if (error) return apiError('CREATE_FAILED', error.message, 500)
  return apiOk(data, 201)
}
