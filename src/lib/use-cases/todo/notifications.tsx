import { render } from '@react-email/components'
import { sendEmail } from '@/lib/email/send'
import { createAdminClientUntyped } from '@/lib/supabase/admin'
import { TodoAssignedEmail } from '@/emails/todo-assigned'
import { TodoStatusChangeEmail } from '@/emails/todo-status-change'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export async function notifyAssigned(todoId: string, todoTitle: string, assignedToUserId: string, assignedByName: string, groupSlug: string, groupName: string) {
  const user = await getUserEmail(assignedToUserId)
  if (!user?.email) return

  const prefs = await getPrefs(assignedToUserId)
  if (!prefs?.on_assigned) return

  const todoUrl = `${SITE_URL}/${groupSlug}/apps/todo`

  const html = await render(
    <TodoAssignedEmail
      taskTitle={todoTitle}
      groupName={groupName}
      assignedBy={assignedByName}
      todoUrl={todoUrl}
    />
  )

  await sendEmail({
    to: user.email,
    subject: `[027Apps] Task assigned: ${todoTitle}`,
    html,
  })
}

export async function notifyStatusChange(todoId: string, todoTitle: string, assignedToUserId: string, oldStatus: string, newStatus: string, groupSlug: string, groupName: string) {
  const user = await getUserEmail(assignedToUserId)
  if (!user?.email) return

  const prefs = await getPrefs(assignedToUserId)
  if (!prefs?.on_status_change) return

  const todoUrl = `${SITE_URL}/${groupSlug}/apps/todo`

  const html = await render(
    <TodoStatusChangeEmail
      taskTitle={todoTitle}
      groupName={groupName}
      oldStatus={oldStatus}
      newStatus={newStatus}
      todoUrl={todoUrl}
    />
  )

  await sendEmail({
    to: user.email,
    subject: `[027Apps] Task status changed: ${todoTitle}`,
    html,
  })
}

async function getUserEmail(userId: string): Promise<{ email: string } | null> {
  const supabase = createAdminClientUntyped()
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user ? { email: data.user.email ?? '' } : null
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
