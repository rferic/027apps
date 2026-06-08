import crypto from 'node:crypto'
import { getAppSetting } from '@/lib/use-cases/app-settings'
import { decryptSecret } from '@/lib/secrets'

// ─── Types ───────────────────────────────────────────────

export interface GitHubIssue {
  number: number
  url: string
  state: 'open' | 'closed'
  title: string
  labels: Array<{ name: string; color: string }>
}

export interface TimelineEvent {
  id: string
  event: string
  actor: { login: string; avatar_url: string } | null
  created_at: string
  body?: string
  label?: { name: string; color: string }
  state?: string
}

export interface GitHubComment {
  id: number
  body: string
  user: { login: string; avatar_url: string }
  created_at: string
}

// ─── Cache ───────────────────────────────────────────────

let cachedInstallationToken: { token: string; expiresAt: number } | null = null

// ─── Dry-run ─────────────────────────────────────────────

function logDryRun(action: string, detail?: Record<string, unknown>) {
  console.log('[GH-DRY-RUN]', action, detail ?? '')
}

function isDryRun(): boolean {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development'
  return env === 'development'
}

// ─── Private key from Vault ──────────────────────────────

async function getPrivateKey(): Promise<string> {
  const encrypted = await getAppSetting('github_private_key')
  if (!encrypted || typeof encrypted !== 'string') throw new Error('GitHub private key not configured')
  return decryptSecret(encrypted)
}

// ─── JWT generation ──────────────────────────────────────

function encodeBase64Url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function createAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = encodeBase64Url(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId })
  )
  const input = header + '.' + payload
  const signature = crypto.sign('sha256', Buffer.from(input), privateKey).toString('base64url')
  return input + '.' + signature
}

// ─── Installation token ──────────────────────────────────

async function getAppId(): Promise<string> {
  const id = await getAppSetting('github_app_id')
  if (!id) throw new Error('GitHub App not configured')
  return id as string
}

async function getInstallationId(): Promise<number> {
  const id = await getAppSetting('github_installation_id')
  if (!id) throw new Error('GitHub installation not configured')
  return id as number
}

export async function getInstallationToken(): Promise<string> {
  if (isDryRun()) return 'dry-run-token'

  if (cachedInstallationToken && cachedInstallationToken.expiresAt > Date.now()) {
    return cachedInstallationToken.token
  }

  const [appId, installationId, privateKey] = await Promise.all([
    getAppId(),
    getInstallationId(),
    getPrivateKey(),
  ])

  const jwt = createAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${jwt}`,
      },
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub auth error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  cachedInstallationToken = {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime() - 60000,
  }

  return data.token
}

// ─── GitHub API helpers ──────────────────────────────────

async function ghFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getInstallationToken()
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`
  return fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  })
}

async function getRepo(): Promise<string> {
  const repo = await getAppSetting('github_repo')
  if (!repo) throw new Error('GitHub repo not configured')
  return repo as string
}

// ─── Issues ──────────────────────────────────────────────

export async function createIssue(params: {
  title: string
  body: string
  labels: string[]
}): Promise<GitHubIssue> {
  if (isDryRun()) {
    logDryRun('createIssue', params)
    return { number: 0, url: '', state: 'open', title: params.title, labels: [] }
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      body: params.body,
      labels: params.labels,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub createIssue error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  return {
    number: data.number,
    url: data.html_url,
    state: data.state,
    title: data.title,
    labels: (data.labels ?? []).map((l: { name: string; color: string }) => ({
      name: l.name,
      color: l.color,
    })),
  }
}

export async function closeIssue(
  issueNumber: number,
  stateReason?: 'completed' | 'not_planned'
): Promise<void> {
  if (isDryRun()) {
    logDryRun('closeIssue', { issueNumber, stateReason })
    return
  }

  const repo = await getRepo()
  const body: Record<string, unknown> = { state: 'closed' }
  if (stateReason) body.state_reason = stateReason

  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub closeIssue error: ${response.status} — ${body}`)
  }
}

export async function reopenIssue(issueNumber: number): Promise<void> {
  if (isDryRun()) {
    logDryRun('reopenIssue', { issueNumber })
    return
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'open' }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub reopenIssue error: ${response.status} — ${body}`)
  }
}

async function createLabel(name: string, color: string = 'ededed'): Promise<void> {
  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/labels`, {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  })
  if (!response.ok && response.status !== 422) {
    const body = await response.text()
    throw new Error(`GitHub createLabel error: ${response.status} — ${body}`)
  }
}

export async function updateLabels(
  issueNumber: number,
  labels: string[]
): Promise<void> {
  if (isDryRun()) {
    logDryRun('updateLabels', { issueNumber, labels })
    return
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ labels }),
  })

  if (!response.ok) {
    const body = await response.text()
    // If labels don't exist on the repo, create them and retry
    if (response.status === 422) {
      for (const label of labels) {
        await createLabel(label)
      }
      const retry = await ghFetch(`/repos/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        body: JSON.stringify({ labels }),
      })
      if (!retry.ok) {
        const retryBody = await retry.text()
        throw new Error(`GitHub updateLabels error (after retry): ${retry.status} — ${retryBody}`)
      }
      return
    }
    throw new Error(`GitHub updateLabels error: ${response.status} — ${body}`)
  }
}

export async function getIssueTimeline(
  issueNumber: number
): Promise<TimelineEvent[]> {
  if (isDryRun()) {
    logDryRun('getIssueTimeline', { issueNumber })
    return []
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}/timeline`, {
    headers: { Accept: 'application/vnd.github.mockingbird-preview+json' },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub getIssueTimeline error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  return data.map((e: Record<string, unknown>) => ({
    id: String(e.id),
    event: String(e.event),
    actor: e.actor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? { login: (e.actor as any).login, avatar_url: (e.actor as any).avatar_url }
      : null,
    created_at: String(e.created_at),
    body: e.body as string | undefined,
    label: e.label
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? { name: (e.label as any).name, color: (e.label as any).color }
      : undefined,
    state: e.state as string | undefined,
  }))
}

// ─── Comments ────────────────────────────────────────────

export async function createComment(
  issueNumber: number,
  body: string
): Promise<GitHubComment> {
  if (isDryRun()) {
    logDryRun('createComment', { issueNumber, body: body.slice(0, 100) })
    return { id: 0, body, user: { login: 'dry-run', avatar_url: '' }, created_at: new Date().toISOString() }
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub createComment error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    body: data.body,
    user: { login: data.user.login, avatar_url: data.user.avatar_url },
    created_at: data.created_at,
  }
}

export async function getIssueComments(
  issueNumber: number
): Promise<GitHubComment[]> {
  if (isDryRun()) {
    logDryRun('getIssueComments', { issueNumber })
    return []
  }

  const repo = await getRepo()
  const response = await ghFetch(`/repos/${repo}/issues/${issueNumber}/comments`)

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub getIssueComments error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  return data.map((c: Record<string, unknown>) => ({
    id: c.id as number,
    body: c.body as string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: { login: (c.user as any).login, avatar_url: (c.user as any).avatar_url },
    created_at: c.created_at as string,
  }))
}

// ─── Issue state helpers ─────────────────────────────────

export function statusToGitHubState(
  status: string
): { state: 'open' | 'closed'; reason?: 'completed' | 'not_planned' } | null {
  switch (status) {
    case 'pending':
    case 'reviewing':
    case 'approved':
    case 'in_progress':
    case 'on_hold':
      return { state: 'open' }
    case 'completed':
      return { state: 'closed', reason: 'completed' }
    case 'rejected':
    case 'duplicate':
      return { state: 'closed', reason: 'not_planned' }
    default:
      return null
  }
}

export function gitHubStateToStatus(
  state: string,
  stateReason?: string | null
): string | null {
  if (state === 'open') return 'in_progress'
  if (state === 'closed') {
    if (stateReason === 'completed') return 'completed'
    if (stateReason === 'not_planned') return 'rejected'
    return 'completed'
  }
  return null
}
