import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { createIssue, closeIssue, reopenIssue, updateLabels } from '@/lib/use-cases/inspiration/github'
import { getAppSetting } from '@/lib/use-cases/app-settings'

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
  const enabled = await getAppSetting('github_sync_enabled')
  return !!enabled
}

export async function getGitHubLabelMap(): Promise<Record<string, string>> {
  const raw = await getAppSetting('github_label_map')
  if (raw && typeof raw === 'object') {
    const map: Record<string, string> = {}
    for (const [type, label] of Object.entries(raw as Record<string, { name: string }>)) {
      map[type] = label.name
    }
    return map
  }
  return {}
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

  // Use raw SQL to bypass PostgREST schema cache entirely
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase credentials not configured')

  const safeUrl = issue.url.replace(/'/g, "''")

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }

  async function execSql(sql: string): Promise<void> {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sql }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Failed to link GitHub issue: ${res.status} — ${body}`)
    }
  }

  // Ensure columns exist (in case migration hasn't been applied)
  await execSql(`alter table if exists inspiration_requests add column if not exists github_issue_number integer`)
  await execSql(`alter table if exists inspiration_requests add column if not exists github_issue_url text`)

  // Update the idea with the GitHub issue info
  await execSql(`update inspiration_requests set github_issue_number = ${issue.number}, github_issue_url = '${safeUrl}', updated_at = now() where id = '${idea.id}'`)
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'status: pending',
  reviewing: 'status: reviewing',
  approved: 'status: approved',
  in_progress: 'status: in progress',
  on_hold: 'status: on hold',
  completed: 'status: completed',
  rejected: 'status: rejected',
  duplicate: 'status: duplicate',
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

  // Update labels to reflect the new status
  const labelMap = await getGitHubLabelMap()
  const typeLabel = labelMap[idea.type] ?? 'other'
  const statusLabel = STATUS_LABELS[newStatus]
  const labels = statusLabel ? [typeLabel, statusLabel] : [typeLabel]

  await updateLabels(idea.github_issue_number, labels)

  // Close or reopen the issue based on status change
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
