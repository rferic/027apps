export const NOTIFICATION_TYPES = {
  INSPIRATION_NEW_IDEA: 'inspiration:new_idea',
  INSPIRATION_NEW_COMMENT: 'inspiration:new_comment',
  INSPIRATION_STATUS_CHANGE: 'inspiration:status_change',
  INSPIRATION_VOTE: 'inspiration:vote',
  TODO_ASSIGNED: 'todo:assigned',
  TODO_STATUS_CHANGE: 'todo:status_change',
  EXPENSES_NEW_EXPENSE: 'expenses:new_expense',
  EXPENSES_OWED: 'expenses:owed',
  EXPENSES_PAID: 'expenses:paid',
  EXPENSES_SETTLED: 'expenses:settled',
  GENERAL_INVITATION: 'general:invitation',
  GENERAL_INVITATION_ACCEPTED: 'general:invitation_accepted',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]

export interface PushPayload {
  type: NotificationType
  title: string
  body: string
  data?: {
    /** Mobile screen route to navigate to on tap, e.g. 'split-expenses/[id]' */
    screen?: string
    /** Route params — placeholders in screen are replaced, e.g. { id: 'abc-123' } */
    params?: Record<string, string>
    /** Legacy / extra data */
    [key: string]: unknown
  }
}
