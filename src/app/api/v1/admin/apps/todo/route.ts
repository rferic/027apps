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

export async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const id = body.id as string
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') update.title = body.title
  if (body.description !== undefined) update.description = body.description
  if (typeof body.priority === 'string') update.priority = body.priority
  if (typeof body.status === 'string') { update.status = body.status; if (body.status === 'done') update.completed_at = new Date().toISOString() }
  if (body.category_id !== undefined) update.category_id = typeof body.category_id === 'string' ? body.category_id : null
  if (body.due_date !== undefined) update.due_date = typeof body.due_date === 'string' ? body.due_date : null
  if (body.assigned_to !== undefined) update.assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to : null

  const adminClient = createAdminClientUntyped()
  const { data, error } = await adminClient.from('todo_items').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)
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
