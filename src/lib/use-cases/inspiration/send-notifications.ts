import { render } from '@react-email/components'
import { sendEmail } from '@/lib/email/send'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import InspirationNewCommentEmail, { NEW_COMMENT_SUBJECT } from '@/emails/inspiration-new-comment'
import InspirationStatusChangeEmail, { STATUS_CHANGE_SUBJECT } from '@/emails/inspiration-status-change'
import InspirationClosureEmail, { CLOSURE_SUBJECT } from '@/emails/inspiration-closure'
import InspirationNewIdeaEmail, { NEW_IDEA_SUBJECT } from '@/emails/inspiration-new-idea'

type RequestInfo = {
  id: string
  title: string
  description: string
  user_id: string
  group_id: string
  app_slug: string | null
}

async function getRequest(requestId: string): Promise<RequestInfo | null> {
  const client = createAdminClientUntyped()
  const { data } = await client
    .from('inspiration_requests')
    .select('id, title, description, user_id, group_id, app_slug')
    .eq('id', requestId)
    .maybeSingle()
  return data as RequestInfo | null
}

async function getRecipients(requestId: string, excludeUserId?: string): Promise<string[]> {
  const client = createAdminClientUntyped()

  const request = await getRequest(requestId)
  if (!request) return []

  const [votesResult] = await Promise.all([
    client.from('inspiration_votes').select('user_id').eq('request_id', requestId),
  ])

  const voterIds = (votesResult.data ?? []).map((v) => v.user_id)
  const allIds = [request.user_id, ...voterIds]
  const unique = [...new Set(allIds)]

  if (excludeUserId) return unique.filter((id) => id !== excludeUserId)
  return unique
}

async function getUserEmailMap(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const client = createAdminClientUntyped()
  const results = await Promise.all(
    userIds.map((id) =>
      client.auth.admin.getUserById(id).catch(() => null)
    )
  )

  const map = new Map<string, string>()
  for (const result of results) {
    if (result?.data?.user?.email) {
      map.set(result.data.user.id, result.data.user.email)
    }
  }
  return map
}

async function getUserDisplayName(userId: string): Promise<string> {
  const client = createAdminClientUntyped()
  const { data } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  return (data as { display_name?: string } | null)?.display_name ?? 'Someone'
}

function buildRequestUrl(requestId: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://027apps.vercel.app'
  return `${base}/apps/inspiration?request=${requestId}`
}

export async function notifyNewIdea(
  requestId: string,
  authorId: string,
  authorName: string,
  locale: string = 'en',
  appName?: string,
  appLogoUrl?: string
): Promise<void> {
  try {
    const request = await getRequest(requestId)
    if (!request) return

    // Look up app name from manifest
    let appNameResolved = appName
    let appLogoUrlResolved = appLogoUrl
    if (request.app_slug && !appName) {
      try {
        const { readManifest } = await import('@/lib/apps/manifest')
        const manifest = await readManifest(request.app_slug)
        appNameResolved = manifest.name
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://027apps.vercel.app'
        appLogoUrlResolved = `${baseUrl}/api/apps/${request.app_slug}/logo`
      } catch {
        // ignore
      }
    }

    // Find all admins of the group
    const client = createAdminClientUntyped()
    const { data: admins } = await client
      .from('group_members')
      .select('user_id')
      .eq('group_id', request.group_id)
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const adminIds = admins.map((a: { user_id: string }) => a.user_id).filter((id: string) => id !== authorId)
    if (adminIds.length === 0) return

    const emailMap = await getUserEmailMap(adminIds)
    const validRecipients = adminIds.filter((id) => emailMap.has(id))
    if (validRecipients.length === 0) return

    const requestUrl = buildRequestUrl(requestId)
    const html = await render(
      InspirationNewIdeaEmail({
        authorName,
        title: request.title,
        description: request.description,
        requestUrl,
        appName: appNameResolved,
        appLogoUrl: appLogoUrlResolved,
        locale,
      })
    )

    const rawSubject = NEW_IDEA_SUBJECT[locale] ?? NEW_IDEA_SUBJECT.en
    const subject = rawSubject.replace('{title}', request.title)

    await Promise.all(
      validRecipients.map((to) =>
        sendEmail({ to: emailMap.get(to)!, subject, html }).catch((err) =>
          console.error(`[Inspiration] Failed to send new idea email to ${to}:`, err)
        )
      )
    )
  } catch (err) {
    console.error('[Inspiration] notifyNewIdea failed:', err)
  }
}

export async function notifyNewComment(
  requestId: string,
  commentAuthorId: string,
  commentSnippet: string,
  locale: string = 'en'
): Promise<void> {
  try {
    const request = await getRequest(requestId)
    if (!request) return

    const recipients = await getRecipients(requestId, commentAuthorId)
    if (recipients.length === 0) return

    const [emailMap, commentAuthorName] = await Promise.all([
      getUserEmailMap(recipients),
      getUserDisplayName(commentAuthorId),
    ])

    const validRecipients = recipients.filter((id) => emailMap.has(id))
    if (validRecipients.length === 0) return

    const requestUrl = buildRequestUrl(requestId)
    const html = await render(
      InspirationNewCommentEmail({
        requestTitle: request.title,
        commentAuthor: commentAuthorName,
        commentSnippet,
        requestUrl,
        locale,
      })
    )

    const rawSubject =
      NEW_COMMENT_SUBJECT[locale] ?? NEW_COMMENT_SUBJECT.en
    const subject = rawSubject.replace('{title}', request.title)

    await Promise.all(
      validRecipients.map((to) =>
        sendEmail({ to: emailMap.get(to)!, subject, html }).catch((err) =>
          console.error(
            `[Inspiration] Failed to send new comment email to ${to}:`,
            err
          )
        )
      )
    )
  } catch (err) {
    console.error('[Inspiration] notifyNewComment failed:', err)
  }
}

const CLOSURE_STATUSES = ['completed', 'rejected', 'duplicate']

export async function notifyStatusChange(
  requestId: string,
  oldStatus: string,
  newStatus: string,
  message?: string,
  locale: string = 'en'
): Promise<void> {
  try {
    const request = await getRequest(requestId)
    if (!request) return

    const recipients = await getRecipients(requestId)
    if (recipients.length === 0) return

    const emailMap = await getUserEmailMap(recipients)
    const validRecipients = recipients.filter((id) => emailMap.has(id))
    if (validRecipients.length === 0) return

    const requestUrl = buildRequestUrl(requestId)
    const isClosure = CLOSURE_STATUSES.includes(newStatus)

    let html: string
    let subject: string

    if (isClosure) {
      const appName = request.app_slug ?? undefined
      const appUrl = request.app_slug
        ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/apps/${request.app_slug}`
        : undefined

      html = await render(
        InspirationClosureEmail({
          requestTitle: request.title,
          requestDescription: request.description,
          closureMessage: message,
          appName,
          appUrl,
          locale,
        })
      )
      const rawSubject =
        CLOSURE_SUBJECT[locale] ?? CLOSURE_SUBJECT.en
      subject = rawSubject.replace('{title}', request.title)
    } else {
      html = await render(
        InspirationStatusChangeEmail({
          requestTitle: request.title,
          oldStatus,
          newStatus,
          message,
          requestUrl,
          locale,
        })
      )
      // STATUS_CHANGE_SUBJECT has no {title} placeholder — .replace is a no-op
      subject =
        STATUS_CHANGE_SUBJECT[locale] ?? STATUS_CHANGE_SUBJECT.en
    }

    await Promise.all(
      validRecipients.map((to) =>
        sendEmail({ to: emailMap.get(to)!, subject, html }).catch((err) =>
          console.error(
            `[Inspiration] Failed to send status change email to ${to}:`,
            err
          )
        )
      )
    )
  } catch (err) {
    console.error('[Inspiration] notifyStatusChange failed:', err)
  }
}
