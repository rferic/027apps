import { NextRequest, NextResponse } from 'next/server'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { getAppSetting } from '@/lib/use-cases/app-settings'
import { gitHubStateToStatus } from '@/lib/use-cases/inspiration/github'
import crypto from 'node:crypto'

const db = () => createAdminClientUntyped()

async function verifySignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const secret = await getAppSetting('github_webhook_secret') as string | null
  if (!secret) return false

  const signature = req.headers.get('x-hub-signature-256') ?? ''
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifySignature(req, rawBody))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = req.headers.get('x-github-event')
  if (!event) {
    return NextResponse.json({ error: 'Missing x-github-event header' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    switch (event) {
      case 'issues': {
        await handleIssuesEvent(payload)
        break
      }
      case 'issue_comment': {
        await handleIssueCommentEvent(payload)
        break
      }
      default:
        console.log('[GH-Webhook] Unhandled event:', event)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[GH-Webhook] Error processing event:', err)
    return NextResponse.json({ ok: true })
  }
}

async function handleIssuesEvent(payload: Record<string, unknown>) {
  const action = payload.action as string
  const issue = payload.issue as Record<string, unknown> | undefined
  if (!issue || !issue.number) return

  const issueNumber = issue.number as number

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: idea } = await (db() as any)
    .from('inspiration_requests')
    .select('id, status')
    .eq('github_issue_number', issueNumber)
    .maybeSingle()

  if (!idea) return

  if (action === 'closed') {
    const stateReason = (issue.state_reason as string) ?? null
    const newStatus = gitHubStateToStatus('closed', stateReason)
    if (newStatus && idea.status !== newStatus) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db() as any)
        .from('inspiration_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', idea.id)
    }
  } else if (action === 'reopened') {
    if (idea.status === 'completed' || idea.status === 'rejected' || idea.status === 'duplicate') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db() as any)
        .from('inspiration_requests')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', idea.id)
    }
  }
}

async function handleIssueCommentEvent(payload: Record<string, unknown>) {
  const action = payload.action as string
  if (action !== 'created') return

  const issue = payload.issue as Record<string, unknown> | undefined
  const comment = payload.comment as Record<string, unknown> | undefined
  if (!issue || !comment) return

  const issueNumber = issue.number as number
  const commentId = comment.id as number
  const commentBody = comment.body as string
  const commentUser = comment.user as Record<string, unknown> | undefined

  if (!commentBody || !commentId) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: idea } = await (db() as any)
    .from('inspiration_requests')
    .select('id')
    .eq('github_issue_number', issueNumber)
    .maybeSingle()

  if (!idea) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (db() as any)
    .from('inspiration_comments')
    .select('id')
    .eq('github_comment_id', commentId)
    .maybeSingle()

  if (existing) return

  const authorName = commentUser?.login as string ?? 'GitHub user'
  const body = `${commentBody}\n\n— ${authorName} (via GitHub)`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db() as any)
    .from('inspiration_comments')
    .insert({
      request_id: idea.id,
      user_id: null,
      body,
      github_comment_id: commentId,
    })
}
