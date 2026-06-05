import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => {
  const shared = vi.fn()
  return { createAdminClient: shared, createAdminClientUntyped: shared }
})
vi.mock('@/lib/auth/helpers', () => ({ requireAdmin: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockResolvedValue(resolved),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'limit', 'order', 'rpc', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

// ---------------------------------------------------------------------------
// updateAppOrderAction
// ---------------------------------------------------------------------------

describe('updateAppOrderAction', () => {
  beforeEach(() => vi.resetAllMocks())

  it('updates display_order for all apps in the ordered list', async () => {
    const { requireAdmin } = await import('@/lib/auth/helpers')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' } as Awaited<ReturnType<typeof requireAdmin>>)

    const { createAdminClientUntyped } = await import('@/lib/supabase/admin')

    // Track each update call to verify display_order values
    const updateCalls: Array<{ slug: string; order: number }> = []
    const mockFrom = vi.fn().mockImplementation((_table: string) => {
      return {
        update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          updateCalls.push({ slug: '', order: data.display_order as number })
          return {
            eq: vi.fn().mockImplementation((_field: string, slug: string) => {
              // Update the last call with the slug
              updateCalls[updateCalls.length - 1].slug = slug
              return makeChain(null)
            }),
          }
        }),
      }
    })

    vi.mocked(createAdminClientUntyped).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClientUntyped>)

    const { updateAppOrderAction } = await import('@/app/(admin)/[locale]/admin/settings/apps/actions')
    const result = await updateAppOrderAction(['inspiration', 'todo'])

    expect(result).toEqual({ success: true })
    expect(updateCalls).toHaveLength(2)
    expect(updateCalls[0]).toEqual({ slug: 'inspiration', order: 0 })
    expect(updateCalls[1]).toEqual({ slug: 'todo', order: 1 })
  })

  it('assigns sequential display_order starting from 0', async () => {
    const { requireAdmin } = await import('@/lib/auth/helpers')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' } as Awaited<ReturnType<typeof requireAdmin>>)

    const { createAdminClientUntyped } = await import('@/lib/supabase/admin')

    const updateCalls: number[] = []
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updateCalls.push(data.display_order as number)
        return { eq: vi.fn().mockReturnValue(makeChain(null)) }
      }),
    })

    vi.mocked(createAdminClientUntyped).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClientUntyped>)

    const { updateAppOrderAction } = await import('@/app/(admin)/[locale]/admin/settings/apps/actions')
    const result = await updateAppOrderAction(['a', 'b', 'c', 'd', 'e'])

    expect(result).toEqual({ success: true })
    expect(updateCalls).toEqual([0, 1, 2, 3, 4])
  })

  it('handles empty array gracefully', async () => {
    const { requireAdmin } = await import('@/lib/auth/helpers')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' } as Awaited<ReturnType<typeof requireAdmin>>)

    const { createAdminClientUntyped } = await import('@/lib/supabase/admin')

    const mockFrom = vi.fn()
    vi.mocked(createAdminClientUntyped).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClientUntyped>)

    const { updateAppOrderAction } = await import('@/app/(admin)/[locale]/admin/settings/apps/actions')
    const result = await updateAppOrderAction([])

    expect(result).toEqual({ success: true })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns error when DB update fails', async () => {
    const { requireAdmin } = await import('@/lib/auth/helpers')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' } as Awaited<ReturnType<typeof requireAdmin>>)

    const { createAdminClientUntyped } = await import('@/lib/supabase/admin')

    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB connection lost' } }),
      }),
    })

    vi.mocked(createAdminClientUntyped).mockReturnValue({ from: mockFrom } as unknown as ReturnType<typeof createAdminClientUntyped>)

    const { updateAppOrderAction } = await import('@/app/(admin)/[locale]/admin/settings/apps/actions')
    const result = await updateAppOrderAction(['todo'])

    expect(result).toEqual({ error: 'DB connection lost' })
  })

  it('returns error if not admin', async () => {
    const { requireAdmin } = await import('@/lib/auth/helpers')
    vi.mocked(requireAdmin).mockRejectedValueOnce(new Error('Unauthorized'))

    const { updateAppOrderAction } = await import('@/app/(admin)/[locale]/admin/settings/apps/actions')
    const result = await updateAppOrderAction(['todo'])

    expect(result).toEqual({ error: expect.stringContaining('Unauthorized') })
  })
})
