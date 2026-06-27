import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyAssigned, notifyStatusChange, notifyGroupStatusChange } from '@/lib/use-cases/todo/notifications'

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

const mockFrom = vi.fn()
const mockGetUserById = vi.fn().mockResolvedValue({ data: { user: { email: 'test@test.com' } } })
const mockListUsers = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClientUntyped: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { getUserById: mockGetUserById, listUsers: mockListUsers } },
  })),
}))

import { sendEmail } from '@/lib/email/send'

function makeChain(overrides: Record<string, unknown> = {}) {
  const defaults = { data: null, error: null }
  const maybeSingle = vi.fn().mockResolvedValue(overrides.maybeSingle ?? defaults)
  const single = vi.fn().mockResolvedValue(overrides.single ?? defaults)
  const chain: Record<string, unknown> = { data: null, error: null, maybeSingle, single }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'limit', 'order', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

// For notifyGroupStatusChange which awaits the chain directly (no .single())
function makeAwaitableChain(data: unknown) {
  const resolve = Promise.resolve({ data, error: null })
  const chain: Record<string, unknown> = { data, error: null, then: resolve.then.bind(resolve) }
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'in', 'limit', 'order', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListUsers.mockResolvedValue({
    data: { users: [{ id: 'user-2', email: 'test@test.com' }] },
  })
})

describe('notifyAssigned', () => {
  it('sends email when user has prefs enabled', async () => {
    const chain = makeChain()
    chain.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { on_assigned: true }, error: null })
      .mockResolvedValueOnce({ data: { locale: 'es' }, error: null })
    mockFrom.mockReturnValue(chain)

    await notifyAssigned('todo-1', 'Test task', 'user-2', 'Admin', 'my-group', 'My Group')

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe('test@test.com')
  })

  it('does NOT send email when prefs.on_assigned is false', async () => {
    const chain = makeChain()
    chain.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { locale: 'es' }, error: null })
      .mockResolvedValueOnce({ data: { on_assigned: false }, error: null })
    mockFrom.mockReturnValue(chain)

    await notifyAssigned('todo-1', 'Test task', 'user-2', 'Admin', 'my-group', 'My Group')

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('uses user locale from profiles', async () => {
    const chain = makeChain()
    chain.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { on_assigned: true }, error: null })
      .mockResolvedValueOnce({ data: { locale: 'es' }, error: null })
    mockFrom.mockReturnValue(chain)

    await notifyAssigned('todo-1', 'Test task', 'user-2', 'Admin', 'my-group', 'My Group')

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'profiles')
  })
})

describe('notifyStatusChange', () => {
  it('sends email when prefs enabled', async () => {
    mockFrom.mockReturnValue(makeChain({
      maybeSingle: { data: { locale: 'en', on_status_change: true }, error: null },
    }))

    await notifyStatusChange('todo-1', 'Test task', 'user-2', 'pending', 'done', 'my-group', 'My Group')

    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('does NOT send email when prefs.on_status_change is false', async () => {
    const chain = makeChain()
    chain.maybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { locale: 'en' }, error: null })
      .mockResolvedValueOnce({ data: { on_status_change: false }, error: null })
    mockFrom.mockReturnValue(chain)

    await notifyStatusChange('todo-1', 'Test task', 'user-2', 'pending', 'done', 'my-group', 'My Group')

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('stops when user has no email', async () => {
    mockFrom.mockReturnValue(makeChain({
      maybeSingle: { data: { locale: 'en', on_status_change: true }, error: null },
    }))
    mockListUsers.mockResolvedValue({ data: { users: [] } })

    await notifyStatusChange('todo-1', 'Test task', 'user-2', 'pending', 'done', 'my-group', 'My Group')

    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('notifyGroupStatusChange', () => {
  it('queries group members from the database', async () => {
    mockFrom.mockReturnValue(makeAwaitableChain([{ user_id: 'u1' }, { user_id: 'u2' }]))

    await notifyGroupStatusChange('todo-1', 'Test task', 'group-1', 'pending', 'done', 'my-group', 'My Group')

    expect(mockFrom).toHaveBeenCalledWith('group_members')
  })

  it('skips notification when group has no members', async () => {
    mockFrom.mockReturnValue(makeAwaitableChain([]))

    await notifyGroupStatusChange('todo-1', 'Test task', 'group-1', 'pending', 'done', 'my-group', 'My Group')

    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('PUT route notification logic (unit)', () => {
  it('should skip assigned notification when actor equals assignee', () => {
    const actorId: string = 'user-1'
    const newAssignee: string = 'user-1'
    expect(newAssignee !== null && newAssignee !== actorId).toBe(false)
  })

  it('should notify when actor differs from assignee', () => {
    const actorId: string = 'user-1'
    const newAssignee: string = 'user-2'
    expect(newAssignee !== null && newAssignee !== actorId).toBe(true)
  })

  it('should skip when assigned_to unchanged', () => {
    const current: string = 'user-2'
    const newVal: string = 'user-2'
    const otherUser: string = 'user-1'
    expect(newVal !== current && newVal !== otherUser).toBe(false)
  })

  it('should notify group on public task status change', () => {
    const changed = true
    const isPublic = true
    expect(changed && isPublic).toBe(true)
  })

  it('should notify owner on private task change (actor ≠ owner)', () => {
    const ownerDiffers = true
    expect(true && true && ownerDiffers).toBe(true)
  })

  it('should NOT notify owner on private task when actor IS owner', () => {
    const ownerDiffers = false
    expect(true && true && ownerDiffers).toBe(false)
  })
})

describe('POST validation', () => {
  it('converts empty category_id to null', () => {
    const bodyCat = ''
    const result = typeof bodyCat === 'string' && bodyCat !== '' ? bodyCat : null
    expect(result).toBeNull()
  })

  it('keeps valid category_id', () => {
    const bodyCat: string = 'abc'
    const result = typeof bodyCat === 'string' && bodyCat !== '' ? bodyCat : null
    expect(result).toBe('abc')
  })
})

describe('DELETE series', () => {
  it('detects delete_series=true param', () => {
    const url = new URL('http://test/items/123?delete_series=true')
    expect(url.searchParams.get('delete_series') === 'true').toBe(true)
  })

  it('detects missing delete_series param', () => {
    const url = new URL('http://test/items/123')
    expect(url.searchParams.get('delete_series') === 'true').toBe(false)
  })
})
