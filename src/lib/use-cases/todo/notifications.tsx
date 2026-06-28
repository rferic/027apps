import { render } from '@react-email/components'
import { sendEmail } from '@/lib/email/send'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { TodoAssignedEmail } from '@/emails/todo-assigned'
import { TodoStatusChangeEmail } from '@/emails/todo-status-change'
import { sendPushToUser, sendPushNotifications } from '@/lib/push'
import { NOTIFICATION_TYPES } from '@/lib/push'
import { getUserEmailMap } from '@/lib/use-cases/user-emails'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

async function getEmailTranslations(locale: string, ns: string): Promise<Record<string, string>> {
  try {
    const msgs = await import(`@/i18n/messages/${locale}.json`)
    const section = msgs?.default?.apps?.todo?.emails?.[ns] ?? {}
    return section as Record<string, string>
  } catch {
    return {}
  }
}

async function getUserLocale(userId: string): Promise<string> {
  const db = createAdminClientUntyped()
  const { data } = await db.from('profiles').select('locale').eq('id', userId).maybeSingle()
  return (data?.locale as string) || 'en'
}

export async function notifyAssigned(todoId: string, todoTitle: string, assignedToUserId: string, assignedByName: string, groupSlug: string, groupName: string) {
  const user = await getUserEmail(assignedToUserId)
  if (!user?.email) return

  const prefs = await getPrefs(assignedToUserId)
  if (!prefs?.on_assigned) return

  const locale = await getUserLocale(assignedToUserId)
  const t = await getEmailTranslations(locale, 'assigned')
  const todoUrl = `${SITE_URL}/${locale}/${groupSlug}/apps/todo`

  const html = await render(
    <TodoAssignedEmail
      taskTitle={todoTitle}
      groupName={groupName}
      assignedBy={assignedByName}
      todoUrl={todoUrl}
      previewText={t.preview || `You have been assigned a task: ${todoTitle}`}
      headingText={t.heading || 'Task assigned to you'}
      bodyText={t.body || '{assignedBy} assigned you a task in {groupName}:'}
      viewTaskText={t.view_task || 'View task'}
      sentFromText={t.sent_from || 'Sent from {appName}'}
      rightsText={t.rights || '© {year} {appName}. All rights reserved.'}
    />
  )

  await sendEmail({
    to: user.email,
    subject: t.subject
      ? t.subject.replace('{title}', todoTitle)
      : `[027Apps] Task assigned: ${todoTitle}`,
    html,
  })

  sendPushToUser(assignedToUserId, {
    type: NOTIFICATION_TYPES.TODO_ASSIGNED,
    title: 'Task assigned',
    body: `${assignedByName} assigned you: "${todoTitle}" in ${groupName}`,
    data: { screen: 'todo/[id]', params: { id: todoId }, todoId, groupSlug },
  }).catch((err) => console.error('[TODO] Failed to send push:', err))
}

export async function notifyUnassigned(todoId: string, todoTitle: string, removedUserId: string, removedByName: string, groupSlug: string, groupName: string) {
  sendPushToUser(removedUserId, {
    type: NOTIFICATION_TYPES.TODO_ASSIGNED,
    title: 'Task unassigned',
    body: `${removedByName} removed you from: "${todoTitle}" in ${groupName}`,
    data: { screen: 'todo/[id]', params: { id: todoId }, todoId, groupSlug },
  }).catch((err) => console.error('[TODO] Failed to send push:', err))
}

/** Individual task status change — no push (as per spec). Email stays for data tracking. */
export async function notifyStatusChange(todoId: string, todoTitle: string, assignedToUserId: string, oldStatus: string, newStatus: string, groupSlug: string, groupName: string) {
  const user = await getUserEmail(assignedToUserId)
  if (!user?.email) return

  const prefs = await getPrefs(assignedToUserId)
  if (!prefs?.on_status_change) return

  const locale = await getUserLocale(assignedToUserId)
  const t = await getEmailTranslations(locale, 'status_change')
  const todoUrl = `${SITE_URL}/${locale}/${groupSlug}/apps/todo`

  const html = await render(
    <TodoStatusChangeEmail
      taskTitle={todoTitle}
      groupName={groupName}
      oldStatus={translateStatus(oldStatus, locale)}
      newStatus={translateStatus(newStatus, locale)}
      todoUrl={todoUrl}
      previewText={t.preview || `Task status changed: ${todoTitle}`}
      headingText={t.heading || 'Task status updated'}
      bodyText={t.body || 'A task in {groupName} has changed status:'}
      viewTaskText={t.view_task || 'View task'}
      sentFromText={t.sent_from || 'Sent from {appName}'}
      rightsText={t.rights || '© {year} {appName}. All rights reserved.'}
    />
  )

  await sendEmail({
    to: user.email,
    subject: t.subject
      ? t.subject.replace('{title}', todoTitle)
      : `[027Apps] Task status changed: ${todoTitle}`,
    html,
  })
  // No push for individual task status changes
}

/** Group task status change — push to all members. */
export async function notifyGroupStatusChange(todoId: string, todoTitle: string, groupId: string, oldStatus: string, newStatus: string, groupSlug: string, groupName: string, excludeUserId?: string) {
  const db = createAdminClientUntyped()
  const { data: members } = await db.from('group_members').select('user_id').eq('group_id', groupId)
  if (!members || members.length === 0) return
  const targets = excludeUserId ? members.filter(m => m.user_id !== excludeUserId) : members

  const memberIds = targets.map(m => m.user_id)

  // Send push to all members
  const statusLabel = `${translateStatus(oldStatus, 'en')} → ${translateStatus(newStatus, 'en')}`
  sendPushNotifications(memberIds, {
    type: NOTIFICATION_TYPES.TODO_STATUS_CHANGE,
    title: 'Task status updated',
    body: `"${todoTitle}" in ${groupName}: ${statusLabel}`,
    data: { screen: 'todo/[id]', params: { id: todoId }, todoId, groupSlug, oldStatus, newStatus },
  }).catch((err) => console.error('[TODO] Failed to send push:', err))

  // Batch fetch emails + prefs + locales once
  const [emailMap] = await Promise.all([
    getUserEmailMap(memberIds),
  ])

  // Email each member individually (batched email fetch, individual prefs/locales)
  for (const m of targets) {
    const email = emailMap.get(m.user_id)
    if (!email) continue
    notifyStatusChangeWithEmail(todoId, todoTitle, m.user_id, email, oldStatus, newStatus, groupSlug, groupName).catch(
      (err) => console.error('[TODO] Failed to notify status change:', err)
    )
  }
}

async function notifyStatusChangeWithEmail(todoId: string, todoTitle: string, assignedToUserId: string, email: string, oldStatus: string, newStatus: string, groupSlug: string, groupName: string) {
  const prefs = await getPrefs(assignedToUserId)
  if (!prefs?.on_status_change) return

  const locale = await getUserLocale(assignedToUserId)
  const t = await getEmailTranslations(locale, 'status_change')
  const todoUrl = `${SITE_URL}/${locale}/${groupSlug}/apps/todo`

  const html = await render(
    <TodoStatusChangeEmail
      taskTitle={todoTitle}
      groupName={groupName}
      oldStatus={translateStatus(oldStatus, locale)}
      newStatus={translateStatus(newStatus, locale)}
      todoUrl={todoUrl}
      previewText={t.preview || `Task status changed: ${todoTitle}`}
      headingText={t.heading || 'Task status updated'}
      bodyText={t.body || 'A task in {groupName} has changed status:'}
      viewTaskText={t.view_task || 'View task'}
      sentFromText={t.sent_from || 'Sent from {appName}'}
      rightsText={t.rights || '© {year} {appName}. All rights reserved.'}
    />
  )

  await sendEmail({
    to: email,
    subject: t.subject
      ? t.subject.replace('{title}', todoTitle)
      : `[027Apps] Task status changed: ${todoTitle}`,
    html,
  })
}

function translateStatus(status: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    en: { pending: 'Pending', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled', deleted: 'Deleted' },
    es: { pending: 'Pendiente', in_progress: 'En progreso', done: 'Completada', cancelled: 'Cancelada', deleted: 'Eliminada' },
    ca: { pending: 'Pendent', in_progress: 'En progrés', done: 'Feta', cancelled: 'Cancel·lada', deleted: 'Eliminada' },
    it: { pending: 'In attesa', in_progress: 'In corso', done: 'Completata', cancelled: 'Annullata', deleted: 'Eliminata' },
    fr: { pending: 'En attente', in_progress: 'En cours', done: 'Terminée', cancelled: 'Annulée', deleted: 'Supprimée' },
    de: { pending: 'Ausstehend', in_progress: 'In Bearbeitung', done: 'Erledigt', cancelled: 'Abgebrochen', deleted: 'Gelöscht' },
  }
  return map[locale]?.[status] || status
}

async function getUserEmail(userId: string): Promise<{ email: string } | null> {
  const map = await getUserEmailMap([userId])
  const email = map.get(userId)
  return email ? { email } : null
}

async function getPrefs(userId: string): Promise<{ on_assigned: boolean; on_status_change: boolean } | null> {
  const supabase = createAdminClientUntyped()
  const { data } = await supabase
    .from('todo_notification_prefs')
    .select('on_assigned, on_status_change')
    .eq('user_id', userId)
    .maybeSingle()
  return data as { on_assigned: boolean; on_status_change: boolean } | null
}
