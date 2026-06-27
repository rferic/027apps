import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError, withTiming } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { notifyAssigned, notifyUnassigned, notifyStatusChange, notifyGroupStatusChange } from '@/lib/use-cases/todo/notifications'

export const GET = withTiming(async function GET(req: NextRequest) {
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
})

export const PUT = withTiming(async function PUT(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON', 400) }

  const id = body.id as string
  if (!id) return apiError('BAD_REQUEST', 'Missing id', 400)

  const adminClient = createAdminClientUntyped()
  const { data: existing } = await adminClient.from('todo_items').select('*').eq('id', id).single()
  if (!existing) return apiError('NOT_FOUND', 'Item not found', 404)

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') update.title = body.title
  if (body.description !== undefined) update.description = body.description
  if (typeof body.priority === 'string') update.priority = body.priority
  if (typeof body.status === 'string') { update.status = body.status; if (body.status === 'done') update.completed_at = new Date().toISOString() }
  if (body.category_id !== undefined) update.category_id = typeof body.category_id === 'string' ? body.category_id : null
  if (body.due_date !== undefined) update.due_date = typeof body.due_date === 'string' ? body.due_date : null
  if (body.assigned_to !== undefined) update.assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to : null

  const { data, error } = await adminClient.from('todo_items').update(update).eq('id', id).select().single()
  if (error) return apiError('UPDATE_FAILED', error.message, 500)

  // Fire notifications
  const reqUserId = auth.userId
  if (update.assigned_to !== undefined && update.assigned_to !== existing.assigned_to) {
    // Notify previous assignee they were removed
    if (existing.assigned_to && existing.assigned_to !== reqUserId) {
      void notifyUnassigned(id, data.title as string, existing.assigned_to as string, 'Admin', 'admin', 'Admin')
    }
    // Notify new assignee
    if (update.assigned_to && update.assigned_to !== reqUserId) {
      void notifyAssigned(id, data.title as string, update.assigned_to as string, 'Admin', 'admin', 'Admin')
    }
  }
  if (update.status && update.status !== existing.status) {
    if (existing.visibility === 'public') {
      void notifyGroupStatusChange(id, data.title as string, existing.group_id as string, existing.status as string, update.status as string, 'admin', 'Admin', reqUserId)
    } else if (existing.visibility === 'private' && existing.created_by && existing.created_by !== reqUserId) {
      void notifyStatusChange(id, data.title as string, existing.created_by as string, existing.status as string, update.status as string, 'admin', 'Admin')
    }
  }

  return apiOk(data)
})

export const DELETE = withTiming(async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('BAD_REQUEST', 'Missing id parameter', 400)

  const adminClient = createAdminClientUntyped()

  const { data: existing } = await adminClient.from('todo_items').select('*').eq('id', id).single()
  if (!existing) return apiError('NOT_FOUND', 'Item not found', 404)

  const deleteSeries = new URL(req.url).searchParams.get('delete_series') === 'true'

  if (deleteSeries) {
    const { data: item } = await adminClient.from('todo_items').select('title, due_date').eq('id', id).single()
    if (!item) return apiError('NOT_FOUND', 'Item not found', 404)
    const { error } = await adminClient.from('todo_items')
      .delete()
      .eq('title', item.title)
      .gte('due_date', item.due_date ?? new Date().toISOString().slice(0, 10))
    if (error) return apiError('DELETE_FAILED', error.message, 500)
  } else {
    const { error } = await adminClient.from('todo_items').delete().eq('id', id)
    if (error) return apiError('DELETE_FAILED', error.message, 500)
  }

  // Notify
  const reqUserId = auth.userId
  if (existing.visibility === 'public') {
    void notifyGroupStatusChange(id, existing.title as string, existing.group_id as string, existing.status as string, 'deleted', 'admin', 'Admin', reqUserId)
  } else if (existing.visibility === 'private' && existing.created_by && existing.created_by !== reqUserId) {
    void notifyStatusChange(id, existing.title as string, existing.created_by as string, existing.status as string, 'deleted', 'admin', 'Admin')
  }

  return new Response(null, { status: 204 })
})
