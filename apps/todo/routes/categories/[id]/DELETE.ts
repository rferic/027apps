import { apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, _ctx: HandlerContext) {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  if (!id) return apiError('BAD_REQUEST', 'Missing category ID', 400)

  const force = url.searchParams.get('force') === 'true'
  const db = createAdminClientUntyped()

  // Count items using this category
  const { count, error: countErr } = await db
    .from('todo_items')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)

  if (countErr) return apiError('COUNT_FAILED', countErr.message, 500)

  if (count && count > 0) {
    if (!force) {
      // Fetch category name for the error message
      const { data: cat } = await db.from('todo_categories').select('name').eq('id', id).single()
      return apiError('HAS_ITEMS', `Category has ${count} items`, 409, {
        count: String(count),
        category: cat?.name ?? 'Unknown',
      })
    }

    // Force: nullify category_id on all items
    const { error: nullErr } = await db
      .from('todo_items')
      .update({ category_id: null })
      .eq('category_id', id)

    if (nullErr) return apiError('NULLIFY_FAILED', nullErr.message, 500)
  }

  const { error } = await db.from('todo_categories').delete().eq('id', id)
  if (error) return apiError('DELETE_FAILED', error.message, 500)
  return new Response(null, { status: 204 })
}
