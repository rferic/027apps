import { render } from '@react-email/components'
import { sendEmail } from '@/lib/email/send'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import InspirationNewCommentEmail, { NEW_COMMENT_SUBJECT } from '@/emails/inspiration-new-comment'
import InspirationStatusChangeEmail, { STATUS_CHANGE_SUBJECT } from '@/emails/inspiration-status-change'
import InspirationClosureEmail, { CLOSURE_SUBJECT } from '@/emails/inspiration-closure'
import InspirationNewIdeaEmail, { NEW_IDEA_SUBJECT } from '@/emails/inspiration-new-idea'
import { sendPushNotifications } from '@/lib/push'
import { NOTIFICATION_TYPES } from '@/lib/push'
import { getUserEmailMap } from '@/lib/use-cases/user-emails'

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

async function getAdminIds(groupId: string): Promise<string[]> {
  const client = createAdminClientUntyped()
  const { data: admins } = await client
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('role', 'admin')
  return (admins ?? []).map((a: { user_id: string }) => a.user_id)
}

/**
 * Admins + creator, no duplicates.
 * Excludes commentAuthorId so comment author doesn't get notified about their own comment.
 */
async function getAdminsAndCreator(request: RequestInfo, excludeUserId?: string): Promise<string[]> {
  const adminIds = await getAdminIds(request.group_id)
  const ids = new Set([...adminIds, request.user_id])
  if (excludeUserId) ids.delete(excludeUserId)
  return Array.from(ids)
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

async function getUserDisplayName(userId: string): Promise<string> {
  const client = createAdminClientUntyped()
  const { data } = await client
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  return (data as { display_name?: string } | null)?.display_name ?? 'Someone'
}

function resolveBaseUrl(): string {
  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || ''
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, '')}`
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://027apps.vercel.app'
}

function buildRequestUrl(requestId: string): string {
  const base = resolveBaseUrl()
  return `${base}/apps/inspiration?request=${requestId}`
}

export async function notifyNewIdea(
  requestId: string,
  authorId: string,
  authorName: string,
  assignedAppSlug?: string | null,
  origin?: string
): Promise<void> {
  try {
    const request = await getRequest(requestId)
    if (!request) return

    // Look up assigned app info (app the idea is about)
    let assignedAppName: string | undefined
    let assignedAppLogoUrl: string | undefined
    const assignedSlug = assignedAppSlug ?? request.app_slug
    if (assignedSlug) {
      try {
        const { readManifest } = await import('@/lib/apps/manifest')
        const manifest = await readManifest(assignedSlug)
        assignedAppName = manifest.name
        const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null
        const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? vercelUrl ?? 'https://027apps.vercel.app'
        assignedAppLogoUrl = `${appUrl}/api/apps/${assignedSlug}/logo`
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

    // Get emails AND locales for each admin
    const [{ data: profiles }] = await Promise.all([
      client.from('profiles').select('id, locale').in('id', adminIds),
    ])
    const localeMap = new Map<string, string>()
    if (profiles) {
      for (const p of profiles as Array<{ id: string; locale: string }>) {
        if (p.locale) localeMap.set(p.id, p.locale)
      }
    }

    const emailMap = await getUserEmailMap(adminIds)
    const validRecipients = adminIds.filter((id) => emailMap.has(id))
    if (validRecipients.length === 0) return

    const baseUrl = origin ?? resolveBaseUrl()
    const requestUrl = `${baseUrl}/apps/inspiration?request=${requestId}`

    // Send personalized email per admin (different locale)
    await Promise.all(
      validRecipients.map(async (adminId) => {
        const adminLocale = localeMap.get(adminId) ?? 'en'
        const html = await render(
          InspirationNewIdeaEmail({
            authorName,
            title: request.title,
            description: request.description,
            requestUrl,
            assignedAppName,
            assignedAppLogoUrl,
            locale: adminLocale,
            baseUrl,
          })
        )
        const rawSubject = NEW_IDEA_SUBJECT[adminLocale] ?? NEW_IDEA_SUBJECT.en
        const subject = rawSubject.replace('{title}', request.title)
        await sendEmail({ to: emailMap.get(adminId)!, subject, html }).catch((err) =>
          console.error(`[Inspiration] Failed to send new idea email to ${adminId}:`, err)
        )
      })
    )

    // Send push to admins (fire-and-forget)
    sendPushNotifications(adminIds, {
      type: NOTIFICATION_TYPES.INSPIRATION_NEW_IDEA,
      title: 'New idea submitted',
      body: `${authorName} submitted "${request.title}"`,
      data: { screen: 'inspiration/[id]', params: { id: requestId }, requestId, groupId: request.group_id },
    }).catch((err) => console.error('[Inspiration] Failed to send push:', err))
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

    const recipients = await getAdminsAndCreator(request, commentAuthorId)
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

    // Send push to admins + creator (fire-and-forget)
    sendPushNotifications(recipients, {
      type: NOTIFICATION_TYPES.INSPIRATION_NEW_COMMENT,
      title: `New comment on "${request.title}"`,
      body: `${commentAuthorName}: ${commentSnippet}`,
      data: { screen: 'inspiration/[id]', params: { id: requestId }, requestId, groupId: request.group_id },
    }).catch((err) => console.error('[Inspiration] Failed to send push:', err))
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
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null
      const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? vercelUrl ?? 'https://027apps.vercel.app'
      const appUrl = request.app_slug
        ? `${siteBase}/apps/${request.app_slug}`
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

    // Send push only to the creator
    const statusLabel = isClosure ? newStatus : `${oldStatus} → ${newStatus}`
    sendPushNotifications([request.user_id], {
      type: NOTIFICATION_TYPES.INSPIRATION_STATUS_CHANGE,
      title: `Status updated: "${request.title}"`,
      body: `Changed to ${statusLabel}${message ? ` — ${message}` : ''}`,
      data: { screen: 'inspiration/[id]', params: { id: requestId }, requestId, groupId: request.group_id, oldStatus, newStatus },
    }).catch((err) => console.error('[Inspiration] Failed to send push:', err))
  } catch (err) {
    console.error('[Inspiration] notifyStatusChange failed:', err)
  }
}
