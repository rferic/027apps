import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return apiError('BAD_REQUEST', 'Invalid JSON body', 400) }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (typeof body.emoji === 'string') update.emoji = body.emoji
  if (typeof body.color === 'string') update.color = body.color
  if (typeof body.display_order === 'number') update.display_order = body.display_order

  const adminClient = createAdminClientUntyped()

  // If setting this category as default, unset all others first
  if (body.is_default === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await adminClient.rpc('exec_sql' as any, { sql: 'update todo_categories set is_default = false' })
    update.is_default = true
  } else if (body.is_default === false) {
    // Cannot unset the only default — find another to make default
    const { count } = await adminClient
      .from('todo_categories')
      .select('*', { count: 'exact', head: true })
      .eq('is_default', true)
    if (count && count <= 1) {
      return apiError('VALIDATION_ERROR', 'At least one category must be the default', 422)
    }
    update.is_default = false
  }

  const { data, error } = await adminClient
    .from('todo_categories')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError('UPDATE_FAILED', error.message, 500)
  return apiOk(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'

  const adminClient = createAdminClientUntyped()

  // Count items with this category
  const { count } = await adminClient
    .from('todo_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if (count && count > 0 && !force) {
    return Response.json(
      { error: 'CATEGORY_HAS_ITEMS', fields: { count, category: id } },
      { status: 409 }
    )
  }

  if (count && count > 0 && force) {
    await adminClient.from('todo_items').update({ category_id: null }).eq('category_id', id)
  }

  const { error } = await adminClient.from('todo_categories').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)

  return new Response(null, { status: 204 })
}
