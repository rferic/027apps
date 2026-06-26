import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  if (req.method !== 'POST') return apiError('METHOD_NOT_ALLOWED', 'Use POST', 405)

  if (ctx.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const url = new URL(req.url)
  const segments = url.pathname.split('/')
  const inspIndex = segments.indexOf('inspiration')
  const id = segments[inspIndex + 1]
  if (!id) return apiError('BAD_REQUEST', 'Missing request ID', 400)

  const adminClient = createAdminClientUntyped()

  const { data: idea, error: fetchError } = await adminClient
    .from('inspiration_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !idea) return apiError('NOT_FOUND', 'Request not found', 404)

  if (!idea.github_issue_number) {
    return apiError('CONFLICT', 'This idea does not have a linked GitHub issue', 409)
  }

  const { error: updateError } = await adminClient
    .from('inspiration_requests')
    .update({
      github_issue_number: null,
      github_issue_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) return apiError('UPDATE_ERROR', updateError.message, 500)
  return apiOk({ message: 'GitHub issue unlinked' })
}
