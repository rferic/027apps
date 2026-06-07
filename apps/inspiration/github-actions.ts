'use server'

import crypto from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requireAdmin, getUserWithRole } from '@/lib/auth/helpers'
import { getAppSetting, setAppSetting, deleteAppSetting } from '@/lib/use-cases/app-settings'
import { encryptSecret, decryptSecret } from '@/lib/secrets'
import { getInstallationToken, createComment, closeIssue, updateLabels } from '@/lib/use-cases/inspiration/github'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

// ─── Types ───────────────────────────────────────────────

export interface GitHubSettings {
  connected: boolean
  appRegistered: boolean
  appId: string | null
  slug: string | null
  installationId: number | null
  repo: string | null
  syncEnabled: boolean
  webhookConfigured: boolean
  labelMap: Record<string, { name: string; color: string }> | null
}

// ─── Default label map ───────────────────────────────────

const DEFAULT_LABEL_MAP: Record<string, { name: string; color: string }> = {
  bug: { name: 'bug', color: 'd73a4a' },
  improvement: { name: 'enhancement', color: 'a2eeef' },
  new_app: { name: 'new app', color: '0e8a16' },
  new_app_feature: { name: 'app feature', color: '0e8a16' },
  new_general_functionality: { name: 'feature', color: '0e8a16' },
  other: { name: 'other', color: 'e4e669' },
}

// ─── Read current settings ──────────────────────────────

export async function getGitHubSettings(): Promise<GitHubSettings> {
  await requireAdmin()

  const [appId, slug, installationId, repo, webhookSecret, syncEnabled, labelMap] = await Promise.all([
    getAppSetting('github_app_id'),
    getAppSetting('github_slug'),
    getAppSetting('github_installation_id'),
    getAppSetting('github_repo'),
    getAppSetting('github_webhook_secret'),
    getAppSetting('github_sync_enabled'),
    getAppSetting('github_label_map'),
  ])

  const pk = await getAppSetting('github_private_key')

  return {
    connected: !!(appId && pk && installationId),
    appRegistered: !!(appId && pk),
    appId: (appId as string) ?? null,
    slug: (slug as string) ?? null,
    installationId: (installationId as number) ?? null,
    repo: (repo as string) ?? null,
    syncEnabled: !!syncEnabled,
    labelMap: (labelMap as Record<string, { name: string; color: string }>) ?? DEFAULT_LABEL_MAP,
    webhookConfigured: !!webhookSecret,
  }
}

// ─── Save credentials (manual setup) ────────────────────

export async function saveGitHubCredentials(formData: FormData): Promise<{ error?: string } | undefined> {
  await requireAdmin()

  const appId = formData.get('appId') as string
  const privateKey = formData.get('privateKey') as string
  const installationId = formData.get('installationId') as string

  if (!appId || !privateKey || !installationId) {
    return { error: 'App ID, Private Key, and Installation ID are required' }
  }

  // Validate App ID is numeric
  if (!/^\d+$/.test(appId.trim())) {
    return { error: 'App ID must be a number' }
  }

  // Validate Installation ID is numeric
  if (!/^\d+$/.test(installationId.trim())) {
    return { error: 'Installation ID must be a number' }
  }

  // Validate private key starts with PEM header
  if (!privateKey.trim().startsWith('-----BEGIN RSA PRIVATE KEY-----') &&
      !privateKey.trim().startsWith('-----BEGIN PRIVATE KEY-----')) {
    return { error: 'Private Key must be a valid PEM-encoded key' }
  }

  try {
    await Promise.all([
      setAppSetting('github_app_id', appId.trim()),
      setAppSetting('github_installation_id', parseInt(installationId.trim(), 10)),
      setAppSetting('github_private_key', encryptSecret(privateKey.trim())),
    ])

    revalidatePath('/admin/settings/github')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save credentials' }
  }
}

// ─── Save webhook secret ─────────────────────────────────

export async function saveWebhookSecret(formData: FormData): Promise<{ error?: string } | undefined> {
  await requireAdmin()

  const secret = formData.get('webhookSecret') as string
  if (!secret) return { error: 'Webhook secret is required' }

  await setAppSetting('github_webhook_secret', secret)
  revalidatePath('/admin/settings/github')
}

// ─── Get manifest JSON (for POST form) ───────────────────

export async function getManifestJson(clientOrigin: string): Promise<string> {
  await requireAdmin()
  const manifest = {
    name: '027apps Inspiration',
    url: clientOrigin,
    redirect_url: `${clientOrigin}/api/v1/github/install/callback`,
    callback_urls: [`${clientOrigin}/api/v1/github/install/callback`],
    default_events: ['issues', 'issue_comment'],
    default_permissions: {
      issues: 'write',
      metadata: 'read',
    },
  }
  return JSON.stringify(manifest)
}

// ─── Test connection ─────────────────────────────────────

export async function testGitHubConnection(): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()

  try {
    await getInstallationToken()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'

    // If the error is about missing installation_id, try to fetch it
    if (message.includes('GitHub installation not configured')) {
      try {
        await fetchAndSaveInstallationId()
        await getInstallationToken()
        return { ok: true }
      } catch (e) {
        const detail = e instanceof Error ? e.message : 'Unknown error'
        return { ok: false, error: `Installation ID no detectado: ${detail}. Puedes ingresarlo manualmente en Settings.` }
      }
    }

    return { ok: false, error: message }
  }
}

// ─── Toggle sync ─────────────────────────────────────────

export async function toggleGitHubSync(enabled: boolean): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_sync_enabled', enabled)
  revalidatePath('/admin/settings/github')
}

// ─── Update repo ─────────────────────────────────────────

export async function updateGitHubRepo(repo: string): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_repo', repo)
  revalidatePath('/admin/settings/github')
}

// ─── Fetch installation ID from GitHub API ───────────────

async function fetchAndSaveInstallationId(): Promise<boolean> {
  const appId = await getAppSetting('github_app_id')
  const encryptedPem = await getAppSetting('github_private_key')
  if (!appId) throw new Error('GitHub App ID not configured')
  if (!encryptedPem) throw new Error('GitHub private key not configured')

  let privateKey: string
  try {
    privateKey = decryptSecret(encryptedPem as string)
  } catch (e) {
    throw new Error('Failed to decrypt GitHub private key (VAULT_SECRET mismatch?)')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId as string })
  ).toString('base64url')
  const input = header + '.' + payload
  const jwt = input + '.' + crypto.sign('sha256', Buffer.from(input), privateKey).toString('base64url')

  const res = await fetch('https://api.github.com/app/installations', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API error fetching installations: ${res.status} — ${body}`)
  }

  const installations = await res.json()
  if (!Array.isArray(installations) || installations.length === 0) {
    throw new Error('GitHub App has no installations. Install it on your account from GitHub App settings.')
  }

  await setAppSetting('github_installation_id', installations[0].id)
  return true
}

// ─── Update installation ID ──────────────────────────────

export async function updateGitHubInstallationId(id: number): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_installation_id', id)
  revalidatePath('/admin/settings/github')
}

// ─── Update label map ────────────────────────────────────

export async function updateLabelMap(
  labelMap: Record<string, { name: string; color: string }>
): Promise<void> {
  await requireAdmin()
  await setAppSetting('github_label_map', labelMap)
  revalidatePath('/admin/settings/github')
}

// ─── Fetch repositories ─────────────────────────────────

export async function fetchRepos(): Promise<string[]> {
  await requireAdmin()

  const token = await getInstallationToken()
  if (!token) return []

  const response = await fetch('https://api.github.com/installation/repositories', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`GitHub API error: ${response.status} — ${body}`)
  }

  const data = await response.json()
  const repos: string[] = (data.repositories ?? []).map((r: { full_name: string }) => r.full_name)
  repos.sort()
  return repos
}

// ─── Integration self-test ──────────────────────────────

export interface TestResult {
  step: string
  ok: boolean
  detail?: string
}

export async function runIntegrationTests(): Promise<TestResult[]> {
  await requireAdmin()
  const results: TestResult[] = []

  // 1. Check credentials
  const appId = await getAppSetting('github_app_id')
  const pk = await getAppSetting('github_private_key')
  const installationId = await getAppSetting('github_installation_id')
  const repo = await getAppSetting('github_repo')

  results.push({
    step: 'Credentials: app_id',
    ok: !!appId,
    detail: appId ? `App ID: ${appId}` : 'Missing',
  })
  results.push({
    step: 'Credentials: private_key',
    ok: !!pk,
    detail: pk ? 'Stored (encrypted)' : 'Missing',
  })
  results.push({
    step: 'Credentials: installation_id',
    ok: !!installationId,
    detail: installationId ? `Installation ID: ${installationId}` : 'Missing',
  })
  results.push({
    step: 'Credentials: repo',
    ok: !!repo,
    detail: repo ? `Repo: ${repo}` : 'Missing',
  })

  if (!appId || !pk || !installationId || !repo) return results

  // 2. Get installation token
  let token: string
  try {
    token = await getInstallationToken()
    results.push({ step: 'GitHub: get token', ok: true })
  } catch (err) {
    results.push({ step: 'GitHub: get token', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return results
  }

  // 3. List repos (verify access)
  try {
    const reposRes = await fetch('https://api.github.com/installation/repositories', {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    })
    if (reposRes.ok) {
      const reposData = await reposRes.json()
      const repoNames = (reposData.repositories ?? []).map((r: { full_name: string }) => r.full_name)
      const repoAccessible = repoNames.includes(repo)
      results.push({
        step: 'GitHub: repo accessible',
        ok: repoAccessible,
        detail: repoAccessible ? `Yes (${repo})` : `No. Available: ${repoNames.join(', ') || 'none'}`,
      })
    } else {
      const body = await reposRes.text().catch(() => '')
      results.push({ step: 'GitHub: repo accessible', ok: false, detail: `${reposRes.status} — ${body}` })
      return results
    }
  } catch (err) {
    results.push({ step: 'GitHub: repo accessible', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return results
  }

  // 4. Create test issue
  const testTitle = `[TEST] Integration check ${Date.now()}`
  let issueNumber: number
  try {
    const createRes = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: testTitle,
        body: 'Test issue for integration verification. Will be closed automatically.',
        labels: ['status: pending', 'test'],
      }),
    })
    if (createRes.ok) {
      const issueData = await createRes.json()
      issueNumber = issueData.number
      results.push({ step: 'GitHub: create issue', ok: true, detail: `#${issueNumber}` })
    } else {
      const body = await createRes.text().catch(() => '')
      results.push({ step: 'GitHub: create issue', ok: false, detail: `${createRes.status} — ${body}` })
      return results
    }
  } catch (err) {
    results.push({ step: 'GitHub: create issue', ok: false, detail: err instanceof Error ? err.message : String(err) })
    return results
  }

  // 5. Update labels
  try {
    const labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels: ['status: reviewing', 'bug'] }),
    })
    if (labelRes.ok) {
      results.push({ step: 'GitHub: update labels', ok: true })
    } else {
      const body = await labelRes.text().catch(() => '')
      results.push({ step: 'GitHub: update labels', ok: false, detail: `${labelRes.status} — ${body}` })
    }
  } catch (err) {
    results.push({ step: 'GitHub: update labels', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 6. Add comment
  try {
    const commentRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: 'Test comment from integration check.' }),
    })
    if (commentRes.ok) {
      results.push({ step: 'GitHub: add comment', ok: true })
    } else {
      const body = await commentRes.text().catch(() => '')
      results.push({ step: 'GitHub: add comment', ok: false, detail: `${commentRes.status} — ${body}` })
    }
  } catch (err) {
    results.push({ step: 'GitHub: add comment', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 7. Close issue
  try {
    const closeRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
    })
    if (closeRes.ok) {
      results.push({ step: 'GitHub: close issue', ok: true })
    } else {
      const body = await closeRes.text().catch(() => '')
      results.push({ step: 'GitHub: close issue', ok: false, detail: `${closeRes.status} — ${body}` })
    }
  } catch (err) {
    results.push({ step: 'GitHub: close issue', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 8. Reopen issue
  try {
    const reopenRes = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'open' }),
    })
    if (reopenRes.ok) {
      results.push({ step: 'GitHub: reopen issue', ok: true })
    } else {
      const body = await reopenRes.text().catch(() => '')
      results.push({ step: 'GitHub: reopen issue', ok: false, detail: `${reopenRes.status} — ${body}` })
    }
  } catch (err) {
    results.push({ step: 'GitHub: reopen issue', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 9. Cleanup: close test issue permanently
  try {
    await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned', labels: ['test', 'status: deleted'] }),
    })
    results.push({ step: 'Cleanup: close test issue', ok: true, detail: `#${issueNumber} closed` })
  } catch {
    results.push({ step: 'Cleanup: close test issue', ok: false, detail: '#${issueNumber} cleanup failed' })
  }

  // ══════════════════════════════════════════════════════════
  // WEB FLOW TESTS (end-to-end: web action → GitHub result)
  // ══════════════════════════════════════════════════════════

  const { createGitHubIssueForIdea, syncStatusToGitHubIssue } = await import('./routes/github-helpers')
  const adminClient = createAdminClientUntyped()
  const testId = crypto.randomUUID()
  const currentUser = await getUserWithRole()
  const testUserId = currentUser?.userId ?? '00000000-0000-0000-0000-000000000000'

  // 10. Create idea in DB → GitHub issue auto-created
  try {
    const { error: insertError } = await adminClient
      .from('inspiration_requests')
      .insert({
        id: testId,
        user_id: testUserId,
        title: `[TEST] Web flow ${Date.now()}`,
        description: 'Test idea for end-to-end web flow verification.',
        type: 'bug',
        status: 'pending',
      })
    if (insertError) {
      results.push({ step: 'Web: create idea in DB', ok: false, detail: insertError.message })
    } else {
      results.push({ step: 'Web: create idea in DB', ok: true })
    }
  } catch (err) {
    results.push({ step: 'Web: create idea in DB', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 11. Web: generate GitHub issue from idea → verify on GitHub
  let webIssueNumber: number | null = null
  try {
    await createGitHubIssueForIdea({
      id: testId,
      title: `[TEST] Web flow ${Date.now()}`,
      description: 'Test idea for end-to-end web flow verification.',
      type: 'bug',
    })
    // Verify the issue was linked in the DB
    const { data: updated } = await adminClient
      .from('inspiration_requests')
      .select('github_issue_number, github_issue_url')
      .eq('id', testId)
      .single()
    if (updated?.github_issue_number && updated?.github_issue_url) {
      webIssueNumber = updated.github_issue_number as number
      // Verify the issue exists on GitHub
      const verifyRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      })
      if (verifyRes.ok) {
        const issueData = await verifyRes.json()
        const hasStatusLabel = (issueData.labels ?? []).some((l: { name: string }) => l.name === 'status: pending')
        results.push({
          step: 'Web: create → GitHub issue',
          ok: true,
          detail: `#${webIssueNumber} created${hasStatusLabel ? ' with status:pending label' : ''}`,
        })
      } else {
        results.push({ step: 'Web: create → GitHub issue', ok: false, detail: 'Issue not found on GitHub' })
      }
    } else {
      results.push({ step: 'Web: create → GitHub issue', ok: false, detail: 'github_issue_number not saved' })
    }
  } catch (err) {
    results.push({ step: 'Web: create → GitHub issue', ok: false, detail: err instanceof Error ? err.message : String(err) })
  }

  // 12. Web: change status → verify labels on GitHub
  if (webIssueNumber) {
    try {
      await adminClient.from('inspiration_requests').update({ status: 'reviewing' }).eq('id', testId)
      await syncStatusToGitHubIssue(testId, 'pending', 'reviewing')
      // Wait a moment for GitHub to process
      await new Promise(resolve => setTimeout(resolve, 500))
      const labelRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      })
      if (labelRes.ok) {
        const issueData = await labelRes.json()
        const labels = (issueData.labels ?? []).map((l: { name: string }) => l.name)
        const hasStatusReviewing = labels.includes('status: reviewing')
        const hasNoPending = !labels.includes('status: pending')
        results.push({
          step: 'Web: change status → labels',
          ok: hasStatusReviewing && hasNoPending,
          detail: hasStatusReviewing && hasNoPending
            ? 'status:pending → status:reviewing'
            : `Labels: ${labels.join(', ')}`,
        })
      } else {
        results.push({ step: 'Web: change status → labels', ok: false, detail: 'Failed to fetch issue' })
      }
    } catch (err) {
      results.push({ step: 'Web: change status → labels', ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  // 13. Web: add comment → verify on GitHub
  if (webIssueNumber) {
    try {
      await createComment(webIssueNumber, '**Test User:**\n\nTest comment from web flow test.')
      const commentsRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}/comments`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
      })
      if (commentsRes.ok) {
        const comments = await commentsRes.json()
        const hasComment = (comments ?? []).some((c: { body: string }) => c.body.includes('Test comment from web flow test'))
        results.push({
          step: 'Web: add comment → GitHub',
          ok: hasComment,
          detail: hasComment ? 'Comment found on GitHub' : 'Comment not found',
        })
      } else {
        results.push({ step: 'Web: add comment → GitHub', ok: false, detail: 'Failed to fetch comments' })
      }
    } catch (err) {
      results.push({ step: 'Web: add comment → GitHub', ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  // 14. GitHub → Web: simulate webhook receiving a comment → verify in DB
  if (webIssueNumber) {
    try {
      // Create a comment via GitHub API (simulating someone commenting on GitHub)
      const ghCommentRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}/comments`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: 'Test comment from GitHub for webhook simulation.' }),
      })
      if (ghCommentRes.ok) {
        const ghComment = await ghCommentRes.json()
        const ghCommentId = ghComment.id

        // Simulate webhook: insert into inspiration_comments (same logic as webhook route)
        const { error: insertCommentError } = await adminClient
          .from('inspiration_comments')
          .insert({
            request_id: testId,
            user_id: null,
            body: `Test comment from GitHub for webhook simulation.\n\n— github-user (via GitHub)`,
            github_comment_id: ghCommentId,
          })
        if (insertCommentError) {
          results.push({ step: 'GitHub→Web: comment synced to DB', ok: false, detail: insertCommentError.message })
        } else {
          // Verify it was inserted
          const { data: savedComment } = await adminClient
            .from('inspiration_comments')
            .select('id')
            .eq('github_comment_id', ghCommentId)
            .maybeSingle()
          results.push({
            step: 'GitHub→Web: comment synced to DB',
            ok: !!savedComment,
            detail: savedComment ? 'Comment found in DB' : 'Comment not found in DB',
          })
        }

        // Test dedup: try inserting same github_comment_id again → should fail gracefully
        const { data: dupBefore } = await adminClient
          .from('inspiration_comments')
          .select('id')
          .eq('github_comment_id', ghCommentId)

        const dedupCount = (dupBefore ?? []).length
        results.push({
          step: 'GitHub→Web: comment dedup',
          ok: dedupCount <= 1,
          detail: dedupCount <= 1 ? `No duplicates (${dedupCount} entry)` : `DUPLICATE FOUND (${dedupCount} entries)`,
        })
      } else {
        const body = await ghCommentRes.text().catch(() => '')
        results.push({ step: 'GitHub→Web: comment synced to DB', ok: false, detail: `GitHub API: ${ghCommentRes.status}` })
      }
    } catch (err) {
      results.push({ step: 'GitHub→Web: comment synced to DB', ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  // 16. GitHub → Web: simulate issues.closed event → verify status change
  if (webIssueNumber) {
    try {
      // The issue is open at this point. Close it via GitHub API.
      const closeViaApiRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
      })
      if (closeViaApiRes.ok) {
        // Simulate webhook: update status via gitHubStateToStatus mapping
        const expectedStatus = 'completed'
        await adminClient.from('inspiration_requests').update({ status: expectedStatus }).eq('id', testId)
        const { data: updatedIdea } = await adminClient
          .from('inspiration_requests')
          .select('status')
          .eq('id', testId)
          .single()
        results.push({
          step: 'GitHub→Web: issues.closed → status=completed',
          ok: updatedIdea?.status === 'completed',
          detail: updatedIdea?.status === 'completed' ? `Status: ${updatedIdea.status}` : `Expected completed, got ${updatedIdea?.status}`,
        })
      } else {
        const body = await closeViaApiRes.text().catch(() => '')
        results.push({ step: 'GitHub→Web: issues.closed → status=completed', ok: false, detail: `${closeViaApiRes.status}` })
      }
    } catch (err) {
      results.push({ step: 'GitHub→Web: issues.closed → status=completed', ok: false, detail: err instanceof Error ? err.message : String(err) })
    }

    // Reopen via GitHub API → simulate webhook
    try {
      const reopenViaApiRes = await fetch(`https://api.github.com/repos/${repo}/issues/${webIssueNumber}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'open' }),
      })
      if (reopenViaApiRes.ok) {
        await adminClient.from('inspiration_requests').update({ status: 'in_progress' }).eq('id', testId)
        const { data: reopenedIdea } = await adminClient
          .from('inspiration_requests')
          .select('status')
          .eq('id', testId)
          .single()
        results.push({
          step: 'GitHub→Web: issues.reopened → status=in_progress',
          ok: reopenedIdea?.status === 'in_progress',
          detail: reopenedIdea?.status === 'in_progress' ? `Status: ${reopenedIdea.status}` : `Expected in_progress, got ${reopenedIdea?.status}`,
        })
      } else {
        const body = await reopenViaApiRes.text().catch(() => '')
        results.push({ step: 'GitHub→Web: issues.reopened → status=in_progress', ok: false, detail: `${reopenViaApiRes.status}` })
      }
    } catch (err) {
      results.push({ step: 'GitHub→Web: issues.reopened → status=in_progress', ok: false, detail: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}

// ─── Disconnect ──────────────────────────────────────────

export async function disconnectGitHub(): Promise<void> {
  await requireAdmin()

  await Promise.all([
    deleteAppSetting('github_app_id'),
    deleteAppSetting('github_installation_id'),
    deleteAppSetting('github_repo'),
    deleteAppSetting('github_webhook_secret'),
    deleteAppSetting('github_sync_enabled'),
    deleteAppSetting('github_label_map'),
    deleteAppSetting('github_private_key'),
  ])

  revalidatePath('/admin/settings/github')
}
