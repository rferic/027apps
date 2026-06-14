import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { closeIssue, updateLabels } from '@/lib/use-cases/inspiration/github'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const id = segments[segments.length - 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  // Fetch existing to check ownership and GitHub issue
  const { data: existing, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('user_id, github_issue_number')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return apiError('NOT_FOUND', 'Request not found', 404)

  const isAdmin = ctx.role === 'admin'
  const isCreator = existing.user_id === ctx.userId

  if (!isAdmin && !isCreator) {
    return apiError('FORBIDDEN', 'You do not have permission to delete this request', 403)
  }

  // Close associated GitHub issue before deleting
  if (existing.github_issue_number) {
    void updateLabels(existing.github_issue_number, ['status: deleted'])
      .catch(err => console.error('[Inspiration] Failed to label GitHub issue on delete:', err))
    void closeIssue(existing.github_issue_number)
      .catch(err => console.error('[Inspiration] Failed to close GitHub issue on delete:', err))
  }

  const { error } = await adminClient
    .from('inspiration_requests')
    .delete()
    .eq('id', id)

  if (error) return apiError('DELETE_ERROR', error.message, 500)
  return new Response(null, { status: 204 })
}
