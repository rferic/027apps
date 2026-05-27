import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { createInvitation, acceptInvitation } from '@/lib/use-cases/invitations'

vi.mock('@/lib/supabase/admin')

function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled),
    catch: (onRejected: (v: unknown) => unknown) =>
      Promise.resolve(resolved).catch(onRejected),
    finally: (onFinally: () => void) =>
      Promise.resolve(resolved).finally(onFinally),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  const proxy = new Proxy(chain, {
    get(target, prop) {
      if (prop in target) return target[prop as string]
      const method = vi.fn(() => proxy)
      target[prop as string] = method
      return method
    },
  })
  return proxy
}

describe('createInvitation with groupIds', () => {
  it('creates invitation with group_ids', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'invitations') {
          return makeChain({ token: 'test-token' })
        }
        return makeChain(null)
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as any)

    const result = await createInvitation({
      title: 'Test',
      role: 'member',
      email: 'test@test.com',
      expiresAt: null,
      invitedBy: 'admin-id',
      groupIds: ['g1', 'g2'],
      locale: 'es',
    })

    expect('token' in result).toBe(true)
    if ('token' in result) {
      expect(result.token).toBe('test-token')
    }
  })

  it('creates invitation with empty groupIds', async () => {
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'invitations') {
          return makeChain({ token: 'test-token' })
        }
        return makeChain(null)
      }),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as any)

    const result = await createInvitation({
      title: 'Test',
      role: 'member',
      email: 'test@test.com',
      expiresAt: null,
      invitedBy: 'admin-id',
      groupIds: [],
      locale: 'es',
    })

    expect('token' in result).toBe(true)
  })
})

describe('acceptInvitation with groupIds', () => {
  const mockCreateUser = vi.fn()

  beforeEach(() => {
    mockCreateUser.mockReset()
  })

  const dbPendingInvitation = {
    id: 'inv-1',
    token: 'valid-token',
    title: 'Join us',
    role: 'member',
    email: null,
    invited_by: 'admin-id',
    accepted_by: null,
    accepted_at: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    created_at: new Date().toISOString(),
    group_ids: ['g1', 'g2'],
  }

  it('adds user to all groupIds from invitation', async () => {
    const mockFrom = vi.fn()
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { createUser: mockCreateUser } },
    } as any)

    // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(dbPendingInvitation))
    // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // group_members.insert for g1
    mockFrom.mockReturnValueOnce(makeChain(null))
    // group_members.insert for g2
    mockFrom.mockReturnValueOnce(makeChain(null))
    // invitations.update
    mockFrom.mockReturnValueOnce(makeChain(null))

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    expect(result).toEqual({ success: true })
  })

  it('falls back to first available group when groupIds is empty', async () => {
    const noGroupIdsInvitation = { ...dbPendingInvitation, group_ids: [] }
    const mockFrom = vi.fn()
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { createUser: mockCreateUser } },
    } as any)

    // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(noGroupIdsInvitation))
    // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // groups → find first
    mockFrom.mockReturnValueOnce(makeChain({ id: 'fallback-group' }))
    // group_members.insert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // invitations.update
    mockFrom.mockReturnValueOnce(makeChain(null))

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    expect(result).toEqual({ success: true })
  })

  it('handles invitation without group_ids field (null)', async () => {
    const { group_ids, ...noGroups } = dbPendingInvitation
    const mockFrom = vi.fn()
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { createUser: mockCreateUser } },
    } as any)

    // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(noGroups))
    // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // groups → find first
    mockFrom.mockReturnValueOnce(makeChain({ id: 'fallback-group' }))
    // group_members.insert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // invitations.update
    mockFrom.mockReturnValueOnce(makeChain(null))

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    expect(result).toEqual({ success: true })
  })

  it('ignores duplicate member errors when adding to groups', async () => {
    const mockFrom = vi.fn()
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: { admin: { createUser: mockCreateUser } },
    } as any)

    // getInvitationByToken
    mockFrom.mockReturnValueOnce(makeChain(dbPendingInvitation))
    // profiles.upsert
    mockFrom.mockReturnValueOnce(makeChain(null))
    // group_members.insert for g1 → duplicate key error
    mockFrom.mockReturnValueOnce(makeChain(null, { message: 'duplicate key value violates unique constraint' }))
    // group_members.insert for g2
    mockFrom.mockReturnValueOnce(makeChain(null))
    // invitations.update
    mockFrom.mockReturnValueOnce(makeChain(null))

    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await acceptInvitation('valid-token', {
      email: 'newuser@example.com',
      displayName: 'New User',
      password: 'securepass',
    })
    // Should still succeed — duplicate errors are ignored
    expect(result).toEqual({ success: true })
  })
})
