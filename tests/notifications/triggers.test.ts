import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'

// ---------------------------------------------------------------------------
// Mock infrastructure
// ---------------------------------------------------------------------------

const mockSendPushNotifications = vi.fn().mockResolvedValue(undefined)
const mockSendPushToUser = vi.fn().mockResolvedValue(undefined)
const mockSendEmail = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/push', () => ({
  sendPushNotifications: mockSendPushNotifications,
  sendPushToUser: mockSendPushToUser,
  NOTIFICATION_TYPES: {
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
  },
}))

vi.mock('@/lib/email/send', () => ({
  sendEmail: mockSendEmail,
}))

function MockComponent({ children }: { children?: React.ReactNode }) {
  return React.createElement('mock-element', null, children)
}
vi.mock('@react-email/components', () => ({
  render: vi.fn().mockResolvedValue('<html><body>Mocked email</body></html>'),
  Body: MockComponent,
  Container: MockComponent,
  Head: MockComponent,
  Html: MockComponent,
  Link: MockComponent,
  Preview: MockComponent,
}))

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

function makeChain(data: unknown, error: unknown = null, count?: number) {
  const resolved: Record<string, unknown> = { data, error }
  if (count !== undefined) resolved.count = count
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'limit', 'order', 'rpc', 'filter', 'or', 'range', 'not', 'neq']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

const mockFrom = vi.fn()
const mockGetUserById = vi.fn()
const mockListUsers = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClientUntyped: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById, listUsers: mockListUsers } },
  })),
}))

// ---------------------------------------------------------------------------
// Global beforeEach: fully reset all mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
  // Re-apply default mock implementations (resetAllMocks clears them)
  mockSendPushNotifications.mockResolvedValue(undefined)
  mockSendPushToUser.mockResolvedValue(undefined)
  mockSendEmail.mockResolvedValue(undefined)
  mockGetUserById.mockResolvedValue({ data: { user: null } })
  // Default listUsers returns all known test users
  mockListUsers.mockResolvedValue({
    data: { users: [
      { id: 'u1', email: 'u1@test.com' },
      { id: 'u2', email: 'u2@test.com' },
      { id: 'u3', email: 'u3@test.com' },
      { id: 'author', email: 'author@test.com' },
      { id: 'comment-author', email: 'comment-author@test.com' },
    ] },
  })
})

// ===========================================================================
// SPLIT EXPENSES NOTIFICATIONS
// ===========================================================================

describe('Split Expenses notifications', () => {
  const expenseGroupId = 'exp-grp-1'
  const groupId = 'group-1'
  const paidById = 'u1'

  describe('notifyNewExpense', () => {
    it('sends push to other participants (not the payer)', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Vacation', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Alice' }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Bob' }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Charlie' }))

      const { notifyNewExpense } = await import('../../apps/split-expenses/notifications')
      await notifyNewExpense(expenseGroupId, paidById, 'Dinner', 45.50, ['u1', 'u2', 'u3'])

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushNotifications.mock.calls[0]
      expect(pushCall[0]).toEqual(['u2', 'u3'])
      expect(pushCall[1].type).toBe('expenses:new_expense')
      expect(pushCall[1].title).toContain('Vacation')
      expect(pushCall[1].body).toContain('45.50')
      expect(pushCall[1].data).toMatchObject({ expenseGroupId, groupId })

      expect(mockSendPushToUser).toHaveBeenCalledTimes(1)
      expect(mockSendPushToUser.mock.calls[0][0]).toBe('u1')
      expect(mockSendPushToUser.mock.calls[0][1].type).toBe('expenses:owed')
    })

    it('skips push when payer is the only participant', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Solo', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'SoloPayer' }))

      const { notifyNewExpense } = await import('../../apps/split-expenses/notifications')
      await notifyNewExpense(expenseGroupId, paidById, 'Solo expense', 10, ['u1'])

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendPushToUser).not.toHaveBeenCalled()
    })

    it('does not notify when group is not found', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifyNewExpense } = await import('../../apps/split-expenses/notifications')
      await notifyNewExpense(expenseGroupId, paidById, 'Ghost group', 10, ['u1', 'u2'])

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('handles missing display names gracefully', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Vacation', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain(null))
      mockFrom.mockReturnValueOnce(makeChain(null))
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifyNewExpense } = await import('../../apps/split-expenses/notifications')
      await notifyNewExpense(expenseGroupId, paidById, 'Test', 10, ['u1', 'u2', 'u3'])

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      expect(mockSendPushNotifications.mock.calls[0][1].body).toContain('Someone')
    })
  })

  describe('notifyPayment', () => {
    it('sends push to the recipient about payment received', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Vacation', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Bob' }))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Alice' }))

      const { notifyPayment } = await import('../../apps/split-expenses/notifications')
      await notifyPayment(expenseGroupId, 'u2', 'u3', 25)

      expect(mockSendPushToUser).toHaveBeenCalledTimes(1)
      const call = mockSendPushToUser.mock.calls[0]
      expect(call[0]).toBe('u3')
      expect(call[1].type).toBe('expenses:paid')
      expect(call[1].title).toContain('Vacation')
      expect(call[1].body).toContain('Bob')
      expect(call[1].body).toContain('25.00')
      expect(call[1].data).toMatchObject({ expenseGroupId, groupId })
    })

    it('does not notify when group is not found', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifyPayment } = await import('../../apps/split-expenses/notifications')
      await notifyPayment(expenseGroupId, 'u2', 'u3', 25)

      expect(mockSendPushToUser).not.toHaveBeenCalled()
    })
  })

  describe('notifySettled', () => {
    it('sends push to all group members when debts are settled', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Vacation', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Alice' }))

      const { notifySettled } = await import('../../apps/split-expenses/notifications')
      await notifySettled(expenseGroupId, 'u1')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const call = mockSendPushNotifications.mock.calls[0]
      expect(call[0]).toEqual(['u1', 'u2', 'u3'])
      expect(call[1].type).toBe('expenses:settled')
      expect(call[1].body).toContain('Alice')
    })

    it('does not notify when group has no members', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ title: 'Vacation', group_id: groupId }))
      mockFrom.mockReturnValueOnce(makeChain([]))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Alice' }))

      const { notifySettled } = await import('../../apps/split-expenses/notifications')
      await notifySettled(expenseGroupId, 'u1')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('does not notify when group is not found', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifySettled } = await import('../../apps/split-expenses/notifications')
      await notifySettled(expenseGroupId, 'u1')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// INSPIRATION NOTIFICATIONS
// ===========================================================================

describe('Inspiration notifications', () => {
  const requestId = 'req-1'
  const requestGroupId = 'group-1'
  const authorId = 'u1'
  const requestTitle = 'Add dark mode'

  const sampleRequest = {
    id: requestId,
    title: requestTitle,
    description: 'Please add a dark mode toggle',
    user_id: authorId,
    group_id: requestGroupId,
    app_slug: null,
  }

  describe('notifyNewIdea', () => {
    it('sends push+email to group admins (excluding author)', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }, { user_id: 'u3' }]))
      mockFrom.mockReturnValueOnce(makeChain([
        { id: 'u2', locale: 'en' },
        { id: 'u3', locale: 'es' },
      ]))

      const { notifyNewIdea } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewIdea(requestId, authorId, 'AuthorName', null, 'http://localhost:3000')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushNotifications.mock.calls[0]
      expect(pushCall[0]).toEqual(['u2', 'u3'])
      expect(pushCall[1].type).toBe('inspiration:new_idea')
      expect(pushCall[1].title).toBe('New idea submitted')
      expect(pushCall[1].body).toContain(requestTitle)
      expect(pushCall[1].data).toMatchObject({ requestId, groupId: requestGroupId })

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      const tos = mockSendEmail.mock.calls.map((c: unknown[]) => (c[0] as { to: string }).to).sort()
      expect(tos).toEqual(['u2@test.com', 'u3@test.com'])
    })

    it('does not notify when there are no admins other than author', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: authorId }]))

      const { notifyNewIdea } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewIdea(requestId, authorId, 'AuthorName', null, 'http://localhost:3000')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('does not notify when request is not found', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifyNewIdea } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewIdea(requestId, authorId, 'AuthorName')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('includes deep link data in push payload', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }]))
      mockFrom.mockReturnValueOnce(makeChain([{ id: 'u2', locale: 'en' }]))

      const { notifyNewIdea } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewIdea(requestId, authorId, 'AuthorName')

      const pushData = mockSendPushNotifications.mock.calls[0][1].data
      expect(pushData).toMatchObject({ requestId, groupId: requestGroupId })
      expect(pushData.requestId).toBe(requestId)
      expect(pushData.groupId).toBe(requestGroupId)
    })
  })

  describe('notifyNewComment', () => {
    it('sends push+email to admins and creator (excluding comment author)', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }]))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Commenter' }))

      const { notifyNewComment } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewComment(requestId, 'u3', 'Great idea!', 'en')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushNotifications.mock.calls[0]
      expect(pushCall[0]).toEqual(['u2', 'u1'])
      expect(pushCall[1].type).toBe('inspiration:new_comment')
      expect(pushCall[1].body).toContain('Commenter')
      expect(pushCall[1].data).toMatchObject({ requestId, groupId: requestGroupId })

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      const tos = mockSendEmail.mock.calls.map((c: unknown[]) => (c[0] as { to: string }).to).sort()
      expect(tos).toEqual(['u1@test.com', 'u2@test.com'])
    })

    it('excludes the comment author from recipients', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }]))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Creator' }))

      const { notifyNewComment } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewComment(requestId, 'u1', 'My comment', 'en')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      expect(mockSendPushNotifications.mock.calls[0][0]).not.toContain('u1')
    })

    it('does not notify when there are no recipients', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([]))
      mockFrom.mockReturnValueOnce(makeChain({ display_name: 'Author' }))

      const { notifyNewComment } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyNewComment(requestId, 'u1', 'Comment')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })

  describe('notifyStatusChange', () => {
    it('sends push+email when status changes (not closure)', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }]))

      const { notifyStatusChange } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyStatusChange(requestId, 'pending', 'reviewing', undefined, 'en')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushNotifications.mock.calls[0]
      // push goes to creator only
      expect(pushCall[0]).toEqual([authorId])
      expect(pushCall[1].type).toBe('inspiration:status_change')
      expect(pushCall[1].data).toMatchObject({
        requestId,
        groupId: requestGroupId,
        oldStatus: 'pending',
        newStatus: 'reviewing',
      })
      expect(mockSendEmail).toHaveBeenCalledTimes(2)
    })

    it('sends closure notification when status is completed', async () => {
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain(sampleRequest))
      mockFrom.mockReturnValueOnce(makeChain([{ user_id: 'u2' }]))

      const { notifyStatusChange } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyStatusChange(requestId, 'reviewing', 'completed', 'Impl done', 'en')

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushNotifications.mock.calls[0]
      expect(pushCall[1].type).toBe('inspiration:status_change')
      expect(pushCall[1].body).toContain('completed')
    })

    it('does not notify when request is not found', async () => {
      mockFrom.mockReturnValueOnce(makeChain(null))

      const { notifyStatusChange } = await import('@/lib/use-cases/inspiration/send-notifications')
      await notifyStatusChange(requestId, 'pending', 'reviewing')

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// TODO NOTIFICATIONS — individual
// ===========================================================================

describe('TODO notifications — individual', () => {
  const todoId = 'todo-1'
  const todoTitle = 'Buy groceries'
  const assignedTo = 'u2'
  const assignedBy = 'Admin'
  const groupSlug = 'family'
  const groupName = 'My Family'

  describe('notifyAssigned', () => {
    it('sends push+email when user has prefs enabled', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ on_assigned: true }))
      mockFrom.mockReturnValueOnce(makeChain({ locale: 'en' }))

      const { notifyAssigned } = await import('@/lib/use-cases/todo/notifications')
      await notifyAssigned(todoId, todoTitle, assignedTo, assignedBy, groupSlug, groupName)

      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail.mock.calls[0][0].to).toBe('u2@test.com')
      expect(mockSendEmail.mock.calls[0][0].subject).toContain(todoTitle)

      expect(mockSendPushToUser).toHaveBeenCalledTimes(1)
      const pushCall = mockSendPushToUser.mock.calls[0]
      expect(pushCall[0]).toBe(assignedTo)
      expect(pushCall[1].type).toBe('todo:assigned')
      expect(pushCall[1].data).toMatchObject({ todoId, groupSlug })
    })

    it('does not send when user has no email', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [] } })

      const { notifyAssigned } = await import('@/lib/use-cases/todo/notifications')
      await notifyAssigned(todoId, todoTitle, assignedTo, assignedBy, groupSlug, groupName)

      expect(mockSendEmail).not.toHaveBeenCalled()
      expect(mockSendPushToUser).not.toHaveBeenCalled()
    })

    it('skips both email and push when prefs.on_assigned is false', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ on_assigned: false }))

      const { notifyAssigned } = await import('@/lib/use-cases/todo/notifications')
      await notifyAssigned(todoId, todoTitle, assignedTo, assignedBy, groupSlug, groupName)

      // Function returns early before email AND push
      expect(mockSendEmail).not.toHaveBeenCalled()
      expect(mockSendPushToUser).not.toHaveBeenCalled()
    })
  })

  describe('notifyUnassigned', () => {
    it('sends push when user is unassigned', async () => {
      const { notifyUnassigned } = await import('@/lib/use-cases/todo/notifications')
      await notifyUnassigned(todoId, todoTitle, assignedTo, assignedBy, groupSlug, groupName)

      expect(mockSendPushToUser).toHaveBeenCalledTimes(1)
      const call = mockSendPushToUser.mock.calls[0]
      expect(call[0]).toBe(assignedTo)
      expect(call[1].type).toBe('todo:assigned')
      expect(call[1].title).toBe('Task unassigned')
    })
  })

  describe('notifyStatusChange', () => {
    it('sends email when prefs.on_status_change is true (no push per spec)', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ on_status_change: true }))
      mockFrom.mockReturnValueOnce(makeChain({ locale: 'en' }))

      const { notifyStatusChange } = await import('@/lib/use-cases/todo/notifications')
      await notifyStatusChange(todoId, todoTitle, assignedTo, 'pending', 'done', groupSlug, groupName)

      expect(mockSendEmail).toHaveBeenCalledTimes(1)
      expect(mockSendEmail.mock.calls[0][0].subject).toContain(todoTitle)
      expect(mockSendPushToUser).not.toHaveBeenCalled()
      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })

    it('does not send email when prefs.on_status_change is false', async () => {
      mockFrom.mockReturnValueOnce(makeChain({ on_status_change: false }))

      const { notifyStatusChange } = await import('@/lib/use-cases/todo/notifications')
      await notifyStatusChange(todoId, todoTitle, assignedTo, 'pending', 'done', groupSlug, groupName)

      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it('does not send when user has no email', async () => {
      mockListUsers.mockResolvedValue({ data: { users: [] } })

      const { notifyStatusChange } = await import('@/lib/use-cases/todo/notifications')
      await notifyStatusChange(todoId, todoTitle, assignedTo, 'pending', 'done', groupSlug, groupName)

      expect(mockSendEmail).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// TODO NOTIFICATIONS — group (at end to avoid cascade pollution)
// ===========================================================================

describe('TODO notifications — group', () => {
  const todoId = 'todo-1'
  const todoTitle = 'Buy groceries'
  const groupSlug = 'family'
  const groupName = 'My Family'
  const groupId = 'g1'

  describe('notifyGroupStatusChange', () => {
    it('sends push to all group members', async () => {
      mockFrom.mockReturnValueOnce(makeChain([
        { user_id: 'u1' },
        { user_id: 'u2' },
        { user_id: 'u3' },
      ]))

      const { notifyGroupStatusChange } = await import('@/lib/use-cases/todo/notifications')
      notifyGroupStatusChange(todoId, todoTitle, groupId, 'pending', 'done', groupSlug, groupName)
      await new Promise((r) => setTimeout(r, 100))

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      const call = mockSendPushNotifications.mock.calls[0]
      expect(call[0]).toEqual(['u1', 'u2', 'u3'])
      expect(call[1].type).toBe('todo:status_change')
      expect(call[1].data).toMatchObject({ todoId, groupSlug, oldStatus: 'pending', newStatus: 'done' })
    })

    it('excludes specified user from push recipients', async () => {
      mockFrom.mockReturnValueOnce(makeChain([
        { user_id: 'u1' },
        { user_id: 'u2' },
      ]))

      const { notifyGroupStatusChange } = await import('@/lib/use-cases/todo/notifications')
      notifyGroupStatusChange(todoId, todoTitle, groupId, 'pending', 'done', groupSlug, groupName, 'u1')
      await new Promise((r) => setTimeout(r, 100))

      expect(mockSendPushNotifications).toHaveBeenCalledTimes(1)
      expect(mockSendPushNotifications.mock.calls[0][0]).toEqual(['u2'])
    })

    it('does not send push when group has no members', async () => {
      mockFrom.mockReturnValueOnce(makeChain([]))

      const { notifyGroupStatusChange } = await import('@/lib/use-cases/todo/notifications')
      notifyGroupStatusChange(todoId, todoTitle, groupId, 'pending', 'done', groupSlug, groupName)
      await new Promise((r) => setTimeout(r, 100))

      expect(mockSendPushNotifications).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// NOTIFICATION SYSTEM (types + utilities)
// ===========================================================================

describe('Notification system — types & utilities', () => {
  describe('Expo push token validation', () => {
    it('accepts valid Expo push tokens', async () => {
      const { Expo } = await import('expo-server-sdk')
      expect(Expo.isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true)
    })

    it('rejects invalid Expo push tokens', async () => {
      const { Expo } = await import('expo-server-sdk')
      expect(Expo.isExpoPushToken('invalid-token')).toBe(false)
      expect(Expo.isExpoPushToken('')).toBe(false)
    })
  })

  describe('NOTIFICATION_TYPES', () => {
    it('has all expected notification types', async () => {
      const { NOTIFICATION_TYPES } = await import('@/lib/push')

      expect(NOTIFICATION_TYPES.INSPIRATION_NEW_IDEA).toBe('inspiration:new_idea')
      expect(NOTIFICATION_TYPES.INSPIRATION_NEW_COMMENT).toBe('inspiration:new_comment')
      expect(NOTIFICATION_TYPES.INSPIRATION_STATUS_CHANGE).toBe('inspiration:status_change')
      expect(NOTIFICATION_TYPES.TODO_ASSIGNED).toBe('todo:assigned')
      expect(NOTIFICATION_TYPES.TODO_STATUS_CHANGE).toBe('todo:status_change')
      expect(NOTIFICATION_TYPES.EXPENSES_NEW_EXPENSE).toBe('expenses:new_expense')
      expect(NOTIFICATION_TYPES.EXPENSES_PAID).toBe('expenses:paid')
      expect(NOTIFICATION_TYPES.EXPENSES_SETTLED).toBe('expenses:settled')
      expect(NOTIFICATION_TYPES.GENERAL_INVITATION).toBe('general:invitation')
    })

    it('all types follow category:event convention', async () => {
      const { NOTIFICATION_TYPES } = await import('@/lib/push')
      for (const value of Object.values(NOTIFICATION_TYPES)) {
        expect(value).toMatch(/^[a-z_]+:[a-z_]+$/)
      }
    })
  })
})
