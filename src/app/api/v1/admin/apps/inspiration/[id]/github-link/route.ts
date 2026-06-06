import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth'
import { apiOk, apiError } from '@/lib/api/response'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { createGitHubIssueForIdea } from '../../../../../../../../../apps/inspiration/routes/github-helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(req, 'jwt')
  if (auth instanceof Response) return auth
  if (auth.role !== 'admin') return apiError('FORBIDDEN', 'Admin access required', 403)

  const { id } = await params
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
    await createGitHubIssueForIdea(idea as Record<string, unknown>)
    return apiOk({ message: 'GitHub issue created' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError('GITHUB_ERROR', `Failed to create GitHub issue: ${message}`, 500)
  }
}
