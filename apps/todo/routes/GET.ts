import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

const VALID_STATUSES = ['pending', 'in_progress', 'done', 'cancelled'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 500

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const statusParam = url.searchParams.get('status')
  const priorityParam = url.searchParams.get('priority')
  const categoryParam = url.searchParams.get('category_id')
  const visibilityParam = url.searchParams.get('visibility')
  const assignedParam = url.searchParams.get('assigned') // 'me', 'unassigned', or empty for all
  const search = url.searchParams.get('search')
  const dateRange = url.searchParams.get('date_range')
  const sort = url.searchParams.get('sort') || 'newest'
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const db = createAdminClientUntyped()

  let query = db.from('todo_items').select('*', { count: 'exact' })
    .eq('group_id', ctx.groupId)

  // Visibility filter
  if (visibilityParam === 'public') query = query.eq('visibility', 'public')
  else if (visibilityParam === 'private') query = query.eq('visibility', 'private').eq('created_by', ctx.userId ?? '')

  // Status filter
  if (statusParam) {
    const statuses = statusParam.split(',').filter(s => VALID_STATUSES.includes(s as typeof VALID_STATUSES[number]))
    if (statuses.length > 0) query = query.in('status', statuses)
  }

  // Priority filter
  if (priorityParam) {
    const priorities = priorityParam.split(',').filter(p => VALID_PRIORITIES.includes(p as typeof VALID_PRIORITIES[number]))
    if (priorities.length > 0) query = query.in('priority', priorities)
  }

  // Category filter
  if (categoryParam) query = query.eq('category_id', categoryParam)

  // Assignment filter
  if (assignedParam === 'me' && ctx.userId) query = query.eq('assigned_to', ctx.userId)
  else if (assignedParam === 'unassigned') query = query.is('assigned_to', null)

  // Date range filter
  if (dateRange === 'today') {
    const today = new Date().toISOString().slice(0, 10)
    query = query.eq('due_date', today)
  } else if (dateRange === 'week') {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString().slice(0, 10)
    query = query.gte('due_date', now.toISOString().slice(0, 10)).lte('due_date', end)
  } else if (dateRange === 'month') {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().slice(0, 10)
    query = query.gte('due_date', now.toISOString().slice(0, 10)).lte('due_date', end)
  }

  // Search
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

  // Sort
  if (sort === 'oldest') query = query.order('created_at', { ascending: true })
  else if (sort === 'due_date') query = query.order('due_date', { ascending: true })
  else if (sort === 'priority') query = query.order('priority', { ascending: false })
  else query = query.order('created_at', { ascending: false })

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: rows, error, count } = await query
  if (error) return apiError('QUERY_ERROR', error.message, 500)

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  return apiOk({
    data: rows ?? [],
    pagination: { page, limit, total, total_pages: totalPages },
  })
}
