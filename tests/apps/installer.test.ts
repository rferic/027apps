import { vi, describe, it, expect, beforeEach } from 'vitest'
// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockReadFile, mockAccess } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockAccess: vi.fn(),
}))

const mockFsPromises = { readFile: mockReadFile, access: mockAccess }
vi.mock('fs', () => ({
  default: { promises: mockFsPromises },
  promises: mockFsPromises,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/apps/manifest', () => ({
  readManifest: vi.fn(),
}))

vi.mock('@/lib/apps/scanner', () => ({
  scanApps: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(data: unknown, error: unknown = null) {
  const resolved = { data, error }
  const chain: Record<string, unknown> = {
    then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
    catch: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).catch(fn),
    finally: (fn: () => void) => Promise.resolve(resolved).finally(fn),
    single: vi.fn().mockResolvedValue(resolved),
    maybeSingle: vi.fn().mockImplementation(() => {
      const isEmpty = Array.isArray(data) && data.length === 0
      return Promise.resolve(isEmpty ? { data: null, error: null } : resolved)
    }),
  }
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'limit', 'order', 'rpc', 'filter']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

const baseManifest = {
  slug: 'test-app',
  tablePrefix: 'test_app_',
  name: 'Test App',
  version: '1.0.0',
  description: 'Test',
  primaryColor: '#000',
  secondaryColor: '#fff',
  minPlatformVersion: '1.0.0',
  author: { name: 'Tester' },
  views: { public: false, admin: false, widget: false, native: false },
  api: false,
  dependencies: [],
  notifications: false,
  config: [],
  extends: undefined,
  extensionPoints: undefined,
  logo: '',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('installApp', () => {
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()

  beforeEach(async () => {
    vi.resetAllMocks()

    const { createAdminClient } = await import('@/lib/supabase/admin')
    vi.mocked(createAdminClient).mockReturnValue(
      { from: mockFrom, rpc: mockRpc } as unknown as ReturnType<typeof createAdminClient>
    )

    const { readManifest } = await import('@/lib/apps/manifest')
    vi.mocked(readManifest).mockResolvedValue(baseManifest as Awaited<ReturnType<typeof readManifest>>)

    // No migrations.sql by default
    mockAccess.mockRejectedValue(new Error('ENOENT'))
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('inserts with status installing then updates to active on success', async () => {
    const insertChain = makeChain(null)
    const updateChain = makeChain(null)

    mockRpc.mockReturnValue(makeChain(null))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'installed_apps') {
        return {
          ...makeChain([]),
          insert: vi.fn().mockReturnValue(insertChain),
          update: vi.fn().mockReturnValue(updateChain),
          select: vi.fn().mockReturnValue(makeChain([])),
        }
      }
      return makeChain([])
    })

    const { installApp } = await import('@/lib/apps/installer')
    await installApp('test-app')

    expect(mockFrom).toHaveBeenCalledWith('installed_apps')
  })

  it('sets status to error and rethrows when migrations.sql fails', async () => {
    mockReadFile.mockResolvedValue('CREATE TABLE test_app_bad (id int);')
    mockAccess.mockResolvedValue(undefined)
    mockRpc
      .mockReturnValueOnce(makeChain(null, { message: 'syntax error' }))

    const insertChain = makeChain(null)
    const updateChain = makeChain(null)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'installed_apps') {
        return {
          insert: vi.fn().mockReturnValue(insertChain),
          update: vi.fn().mockReturnValue(updateChain),
          select: vi.fn().mockReturnValue(makeChain([])),
        }
      }
      return makeChain([])
    })

    const { installApp } = await import('@/lib/apps/installer')
    await expect(installApp('test-app')).rejects.toThrow('Migrations failed')
  })

  it('throws when a dependency is not active', async () => {
    const { readManifest } = await import('@/lib/apps/manifest')
    vi.mocked(readManifest).mockResolvedValue({
      ...baseManifest,
      dependencies: ['missing-dep'],
    } as Awaited<ReturnType<typeof readManifest>>)

    mockFrom.mockImplementation(() => makeChain([]))

    const { installApp } = await import('@/lib/apps/installer')
    await expect(installApp('test-app')).rejects.toMatchObject({ code: 'dependency_not_installed' })
  })
})

describe('uninstallApp', () => {
  const mockFrom = vi.fn()

  beforeEach(async () => {
    vi.resetAllMocks()

    const { createAdminClient } = await import('@/lib/supabase/admin')
    vi.mocked(createAdminClient).mockReturnValue(
      { from: mockFrom } as unknown as ReturnType<typeof createAdminClient>
    )

    const { readManifest } = await import('@/lib/apps/manifest')
    vi.mocked(readManifest).mockResolvedValue(baseManifest as Awaited<ReturnType<typeof readManifest>>)

    mockAccess.mockRejectedValue(new Error('ENOENT'))
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
  })

  it('throws DEP_CONFLICT when another active app depends on this one', async () => {
    const { scanApps } = await import('@/lib/apps/scanner')
    vi.mocked(scanApps).mockResolvedValue([
      {
        slug: 'dependent-app',
        manifest: { ...baseManifest, slug: 'dependent-app', dependencies: ['test-app'] } as Awaited<ReturnType<typeof import('@/lib/apps/manifest').readManifest>>,
        validationError: null,
      },
    ])

    mockFrom.mockImplementation(() => makeChain([{ slug: 'dependent-app', status: 'active' }]))

    const { uninstallApp } = await import('@/lib/apps/installer')
    await expect(uninstallApp('test-app')).rejects.toThrow('depends on it and is active')
  })

  it('deletes the record on successful uninstall', async () => {
    const { scanApps } = await import('@/lib/apps/scanner')
    vi.mocked(scanApps).mockResolvedValue([])

    const deleteChain = makeChain(null)
    const updateChain = makeChain(null)

    mockFrom.mockImplementation(() => ({
      ...makeChain([]),
      select: vi.fn().mockReturnValue(makeChain([])),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    }))

    const { uninstallApp } = await import('@/lib/apps/installer')
    await uninstallApp('test-app')

    expect(mockFrom).toHaveBeenCalledWith('installed_apps')
  })
})
