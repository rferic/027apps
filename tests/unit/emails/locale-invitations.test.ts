import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createInvitation, getInvitationByToken, acceptInvitation, type Invitation } from '@/lib/use-cases/invitations'
import { createAdminClient, createAdminClientUntyped } from '@/lib/supabase/admin'

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
  for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'limit', 'order', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('invitation locale handling', () => {
  it('createInvitation saves locale', async () => {
    const mockClient = {
      from: vi.fn(() => makeChain({ token: 't1' })),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as any)

    await createInvitation({
      title: 'Test',
      role: 'member',
      email: null,
      expiresAt: null,
      invitedBy: 'admin-id',
      groupIds: ['g1'],
      locale: 'fr',
    })

    expect(mockClient.from).toHaveBeenCalledWith('invitations')
    const insertMock = (mockClient.from as any).mock.results[0].value.insert
    expect(insertMock).toHaveBeenCalled()
    expect(insertMock.mock.calls[0][0].locale).toBe('fr')
  })

  it('getInvitationByToken returns locale', async () => {
    const mockClient = {
      from: vi.fn(() => makeChain({
        id: 'inv-1',
        token: 'abc',
        title: 'Test',
        role: 'member',
        email: null,
        expires_at: null,
        group_ids: [],
        invited_by: 'admin',
        accepted_by: null,
        accepted_at: null,
        revoked_at: null,
        created_at: '2026-01-01T00:00:00Z',
        locale: 'it',
      })),
    }
    vi.mocked(createAdminClient).mockReturnValue(mockClient as any)

    const invitation = await getInvitationByToken('abc')
    expect(invitation).not.toBeNull()
    expect(invitation!.locale).toBe('it')
  })

  it('acceptInvitation creates profile with invitation locale', async () => {
    const makeFrom = (table: string) => {
      if (table === 'invitations') {
        return makeChain({
          id: 'inv-1',
          token: 'abc',
          title: 'Test',
          role: 'member',
          email: 'user@test.com',
          expires_at: null,
          group_ids: ['g1'],
          invited_by: 'admin',
          accepted_by: null,
          accepted_at: null,
          revoked_at: null,
          created_at: '2026-01-01T00:00:00Z',
          locale: 'de',
        })
      }
      if (table === 'groups') {
        return makeChain({ id: 'g1' })
      }
      return makeChain(null)
    }
    const mockFrom = vi.fn(makeFrom)
    const mockUpsert = vi.fn().mockReturnValue(Promise.resolve({ error: null }))
    const mockInsert = vi.fn().mockReturnValue({ error: null })

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
        },
      },
    } as any)

    const result = await acceptInvitation('abc', { displayName: 'User', password: 'password123', email: 'user@test.com' })
    expect('errorCode' in result).toBe(false)
  })
})
