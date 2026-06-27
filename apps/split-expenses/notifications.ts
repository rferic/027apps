import { sendPushNotifications, sendPushToUser } from '@/lib/push'
import { NOTIFICATION_TYPES } from '@/lib/push'
import { createAdminClientUntyped } from '@/lib/supabase/admin'

interface GroupInfo {
  title: string
  group_id: string
}

async function getGroup(expenseGroupId: string): Promise<GroupInfo | null> {
  const db = createAdminClientUntyped()
  const { data } = await db
    .from('split_expenses_groups')
    .select('title, group_id')
    .eq('id', expenseGroupId)
    .maybeSingle()
  return data as GroupInfo | null
}

async function getGroupMembers(expenseGroupId: string): Promise<string[]> {
  const db = createAdminClientUntyped()
  const { data: members } = await db
    .from('split_expenses_members')
    .select('user_id')
    .eq('expense_group_id', expenseGroupId)
    .eq('active', true)
  return (members ?? []).map((m) => (m as { user_id: string }).user_id)
}

async function getUserDisplayName(userId: string): Promise<string> {
  const db = createAdminClientUntyped()
  const { data } = await db
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  return (data as { display_name?: string } | null)?.display_name ?? 'Someone'
}

export async function notifyNewExpense(
  expenseGroupId: string,
  paidByUserId: string,
  title: string,
  amount: number,
  participantIds: string[],
): Promise<void> {
  const group = await getGroup(expenseGroupId)
  if (!group) return

  const [payerName] = await Promise.all([
    getUserDisplayName(paidByUserId),
  ])

  // Only notify implicated members (not all)
  const others = participantIds.filter((id) => id !== paidByUserId)
  if (others.length === 0) return

  const formatted = amount.toFixed(2)

  sendPushNotifications(others, {
    type: NOTIFICATION_TYPES.EXPENSES_NEW_EXPENSE,
    title: `New expense in "${group.title}"`,
    body: `${payerName} added "${title}" — €${formatted}`,
    data: { screen: 'split-expenses/[id]', params: { id: expenseGroupId }, expenseGroupId, groupId: group.group_id },
  }).catch((err) => console.error('[SplitExpenses] Failed to send push:', err))

  // Notify the payer about who owes them
  const participantNames = await Promise.all(
    others.slice(0, 3).map((id) => getUserDisplayName(id)),
  )
  const names =
    participantNames.length <= 2
      ? participantNames.join(' and ')
      : `${participantNames[0]}, ${participantNames[1]} and ${participantNames.length - 2} others`

  sendPushToUser(paidByUserId, {
    type: NOTIFICATION_TYPES.EXPENSES_OWED,
    title: `You are owed in "${group.title}"`,
    body: `${names} owe you €${formatted} for "${title}"`,
    data: { screen: 'split-expenses/[id]', params: { id: expenseGroupId }, expenseGroupId, groupId: group.group_id },
  }).catch((err) => console.error('[SplitExpenses] Failed to send push:', err))
}

export async function notifyPayment(
  expenseGroupId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
): Promise<void> {
  const group = await getGroup(expenseGroupId)
  if (!group) return

  const [fromName, toName] = await Promise.all([
    getUserDisplayName(fromUserId),
    getUserDisplayName(toUserId),
  ])

  const formatted = amount.toFixed(2)

  sendPushToUser(toUserId, {
    type: NOTIFICATION_TYPES.EXPENSES_PAID,
    title: `Payment received in "${group.title}"`,
    body: `${fromName} paid you €${formatted}`,
    data: { screen: 'split-expenses/[id]', params: { id: expenseGroupId }, expenseGroupId, groupId: group.group_id },
  }).catch((err) => console.error('[SplitExpenses] Failed to send push:', err))
}

export async function notifySettled(
  expenseGroupId: string,
  settledByUserId: string,
): Promise<void> {
  const group = await getGroup(expenseGroupId)
  if (!group) return

  const [members, settledByName] = await Promise.all([
    getGroupMembers(expenseGroupId),
    getUserDisplayName(settledByUserId),
  ])

  if (members.length === 0) return

  // Notify all members including the settler
  sendPushNotifications(members, {
    type: NOTIFICATION_TYPES.EXPENSES_SETTLED,
    title: `"${group.title}" is settled!`,
    body: `${settledByName} settled all debts`,
    data: { screen: 'split-expenses/[id]', params: { id: expenseGroupId }, expenseGroupId, groupId: group.group_id },
  }).catch((err) => console.error('[SplitExpenses] Failed to send push:', err))
}
