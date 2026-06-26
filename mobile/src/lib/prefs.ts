import { getApiClient } from './api'

export interface NotificationPrefs {
  global_enabled: boolean
  types: Record<string, boolean>
  all_types: string[]
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const client = await getApiClient()
  const response = await client.notifications.getPrefs()
  if (response.status === 200) return response.body
  return { global_enabled: true, types: {}, all_types: [] }
}

export async function updateNotificationPrefs(prefs: {
  global_enabled?: boolean
  types?: Record<string, boolean>
}): Promise<boolean> {
  const client = await getApiClient()
  const response = await client.notifications.updatePrefs({
    body: prefs,
  })
  return response.status === 200
}

const NOTIFICATION_LABELS: Record<string, { title: string; description: string }> = {
  'inspiration:new_idea': { title: 'New ideas', description: 'When someone submits a new idea' },
  'inspiration:new_comment': { title: 'New comments', description: 'When someone comments on your idea' },
  'inspiration:status_change': { title: 'Status changes', description: 'When an idea status is updated' },
  'inspiration:vote': { title: 'Votes', description: 'When someone votes on your idea' },
  'todo:assigned': { title: 'Task assigned', description: 'When a task is assigned to you' },
  'todo:status_change': { title: 'Task status', description: 'When a task status changes' },
  'expenses:new_expense': { title: 'New expenses', description: 'When a new expense is added' },
  'expenses:owed': { title: 'Debts', description: 'When someone owes you money' },
  'expenses:paid': { title: 'Payments', description: 'When someone pays you' },
  'expenses:settled': { title: 'Settlements', description: 'When a group is settled' },
  'general:invitation': { title: 'Invitations', description: 'When you receive a group invitation' },
  'general:invitation_accepted': { title: 'Invitations accepted', description: 'When someone accepts your invitation' },
}

export function getNotificationLabel(type: string): { title: string; description: string } {
  return NOTIFICATION_LABELS[type] ?? { title: type, description: '' }
}
