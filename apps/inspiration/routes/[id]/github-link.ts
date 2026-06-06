import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { createGitHubIssueForIdea } from '../github-helpers'
import type { HandlerContext } from '@/lib/apps/router-types'

export default async function handler(req: Request, ctx: HandlerContext) {
  if (req.method !== 'POST') return apiError('METHOD_NOT_ALLOWED', 'Use POST', 405)

  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (!auth.userId) return apiError('UNAUTHORIZED', 'User ID required', 401)

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

  if (idea.github_issue_number) {
    return apiError('CONFLICT', 'This idea already has a linked GitHub issue', 409)
  }

  try {
    await createGitHubIssueForIdea(idea as any)
    return apiOk({ message: 'GitHub issue created' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError('GITHUB_ERROR', `Failed to create GitHub issue: ${message}`, 500)
  }
}
