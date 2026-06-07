import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { createIssue, closeIssue, reopenIssue } from '@/lib/use-cases/inspiration/github'

const DEFAULT_LABEL_MAP: Record<string, string> = {
  bug: 'bug',
  improvement: 'enhancement',
  new_app: 'new app',
  new_app_feature: 'app feature',
  new_general_functionality: 'feature',
  other: 'other',
}

function getOwnerAndRepo(repo: string): { owner: string; repo: string } {
  const parts = repo.split('/')
  return { owner: parts[0], repo: parts[1] ?? parts[0] }
}

export async function isGitHubSyncEnabled(): Promise<boolean> {
  const adminClient = createAdminClientUntyped()
  const { data } = await adminClient
    .from('app_settings')
    .select('value')
    .eq('key', 'github_sync_enabled')
    .maybeSingle()
  return data?.value === true
}

export async function getGitHubLabelMap(): Promise<Record<string, string>> {
  const adminClient = createAdminClientUntyped()
  const { data } = await adminClient
    .from('app_settings')
    .select('value')
    .eq('key', 'github_label_map')
    .maybeSingle()
  if (data?.value && typeof data.value === 'object') {
    const map: Record<string, string> = {}
    for (const [type, label] of Object.entries(data.value as Record<string, { name: string }>)) {
      map[type] = label.name
    }
    return map
  }
  return { ...DEFAULT_LABEL_MAP }
}

export async function createGitHubIssueForIdea(idea: {
  id: string
  title: string
  description: string
  type: string
}) {
  const labelMap = await getGitHubLabelMap()
  const labels = [labelMap[idea.type] ?? DEFAULT_LABEL_MAP[idea.type] ?? 'other'].filter(Boolean)
  const body = [
    idea.description,
    '',
    '---',
    `*Idea ID: ${idea.id}*`,
    `*Type: ${idea.type}*`,
  ].join('\n')

  const issue = await createIssue({ title: idea.title, body, labels })

  const adminClient = createAdminClientUntyped()
  const { error: updateError } = await adminClient
    .from('inspiration_requests')
    .update({
      github_issue_number: issue.number,
      github_issue_url: issue.url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idea.id)

  if (updateError) throw new Error(`Failed to link GitHub issue: ${updateError.message}`)
}

export async function syncStatusToGitHubIssue(
  ideaId: string,
  oldStatus: string,
  newStatus: string
) {
  const adminClient = createAdminClientUntyped()
  const { data: idea } = await adminClient
    .from('inspiration_requests')
    .select('github_issue_number, github_issue_url, type')
    .eq('id', ideaId)
    .single()

  if (!idea?.github_issue_number) return

  if (newStatus === 'completed' || newStatus === 'rejected' || newStatus === 'duplicate') {
    const reason = newStatus === 'completed' ? 'completed' : 'not_planned'
    await closeIssue(idea.github_issue_number, reason)
  } else if (oldStatus === 'completed' || oldStatus === 'rejected' || oldStatus === 'duplicate') {
    await reopenIssue(idea.github_issue_number)
  }
}

export async function closeIssueForIdea(ideaId: string) {
  const adminClient = createAdminClientUntyped()
  const { data: idea } = await adminClient
    .from('inspiration_requests')
    .select('github_issue_number, status')
    .eq('id', ideaId)
    .single()

  if (!idea?.github_issue_number) return

  const status = idea.status as string
  if (status === 'completed') {
    await closeIssue(idea.github_issue_number, 'completed')
  } else if (status === 'rejected' || status === 'duplicate') {
    await closeIssue(idea.github_issue_number, 'not_planned')
  } else {
    await closeIssue(idea.github_issue_number)
  }
}
