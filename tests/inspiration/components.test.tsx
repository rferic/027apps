import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppContext } from '@/lib/apps/context'
import type { AppContextValue } from '@/lib/apps/context'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return <a href={href}>{children}</a>
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseManifest = {
  slug: 'inspiration',
  tablePrefix: 'inspiration_',
  name: 'Inspiration',
  version: '1.0.0',
  description: 'Collect and vote on ideas',
  primaryColor: '#8B5CF6',
  secondaryColor: '#C4B5FD',
  minPlatformVersion: '1.0.0',
  author: { name: 'Test', url: 'https://example.com' },
  views: { public: true, admin: false, widget: true, native: false },
  api: true,
  dependencies: [],
  notifications: true,
  config: [],
  logo: '',
}

function wrapWithAppContext(children: React.ReactNode, overrides?: Partial<AppContextValue>) {
  const value: AppContextValue = {
    slug: 'inspiration',
    manifest: baseManifest as AppContextValue['manifest'],
    config: {} as AppContextValue['config'],
    ...overrides,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Mock global fetch for widget data
const mockFetch = vi.fn()
global.fetch = mockFetch

// Stub CSS vars
beforeEach(() => {
  vi.resetAllMocks()
  // Ensure --app-primary is set for inline styles
  document.documentElement.style.setProperty('--app-primary', '#8B5CF6')
})

// ---------------------------------------------------------------------------
// InspirationWidget
// ---------------------------------------------------------------------------

describe('InspirationWidget', () => {
  it('shows "Not available" when groupSlug is undefined', async () => {
    const { default: Widget } = await import('../../apps/inspiration/widget')
    render(wrapWithAppContext(<Widget />, { groupSlug: undefined }))

    expect(screen.getByText('Not available')).toBeDefined()
  })

  it('shows loading spinner initially when groupSlug is set', async () => {
    // fetch never resolves in this test — component stays in loading
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { default: Widget } = await import('../../apps/inspiration/widget')
    render(wrapWithAppContext(<Widget />, { groupSlug: 'test' }))

    // The Loader2 icon is present
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders widget content with data after fetch succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 1, total: 3, total_pages: 3 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'r1', title: 'Dark mode', status: 'pending', vote_count: 12, comment_count: 3, created_at: '2025-01-01T00:00:00Z' },
            { id: 'r2', title: 'Export CSV', status: 'pending', vote_count: 8, comment_count: 1, created_at: '2025-01-02T00:00:00Z' },
          ],
          pagination: { page: 1, limit: 3, total: 5, total_pages: 2 },
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'r3', title: 'Keyboard shortcuts', status: 'completed', vote_count: 25, comment_count: 5, created_at: '2024-12-15T00:00:00Z' },
          ],
          pagination: { page: 1, limit: 2, total: 1, total_pages: 1 },
        })
      } as Response)

    const { default: Widget } = await import('../../apps/inspiration/widget')
    const { container } = render(wrapWithAppContext(<Widget />, { groupSlug: 'test' }))

    // Wait for async state updates
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Inspiration')
    }, { timeout: 2000 })

    expect(container.textContent).toContain('3 active')
    expect(container.textContent).toContain('Most supported')
    expect(container.textContent).toContain('Dark mode')
    expect(container.textContent).toContain('Export CSV')
    expect(container.textContent).toContain('Recently completed')
    expect(container.textContent).toContain('Keyboard shortcuts')
  })

  it('shows "No ideas yet" when fetch returns empty data', async () => {
    const emptyRes = {
      ok: true,
      json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } }),
    } as Response
    mockFetch
      .mockResolvedValueOnce(emptyRes)
      .mockResolvedValueOnce(emptyRes)
      .mockResolvedValueOnce(emptyRes)

    const { default: Widget } = await import('../../apps/inspiration/widget')
    const { container } = render(wrapWithAppContext(<Widget />, { groupSlug: 'test' }))

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No ideas yet')
    }, { timeout: 2000 })
  })

  it('renders "View all ideas" link', async () => {
    const emptyRes = {
      ok: true,
      json: () => Promise.resolve({ data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } }),
    } as Response
    mockFetch
      .mockResolvedValueOnce(emptyRes)
      .mockResolvedValueOnce(emptyRes)
      .mockResolvedValueOnce(emptyRes)

    const { default: Widget } = await import('../../apps/inspiration/widget')
    render(wrapWithAppContext(<Widget />, { groupSlug: 'test' }))

    await vi.waitFor(() => {
      expect(screen.getByText('View all ideas')).toBeDefined()
    }, { timeout: 2000 })
  })
})

// ---------------------------------------------------------------------------
// CreateRequestModal
// ---------------------------------------------------------------------------

describe('CreateRequestModal', () => {
  it('does not render when open=false', async () => {
    const { default: Modal } = await import('../../apps/inspiration/CreateRequestModal')

    const onClose = vi.fn()
    const onCreated = vi.fn()
    const { container } = render(
      wrapWithAppContext(
        <Modal open={false} onClose={onClose} onCreated={onCreated} groupSlug="test" />,
        { groupSlug: 'test' }
      )
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders all 6 request types in step 1', async () => {
    // Mock the /apps endpoint fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ apps: [] }),
    } as Response)

    const { default: Modal } = await import('../../apps/inspiration/CreateRequestModal')

    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(
      wrapWithAppContext(
        <Modal open={true} onClose={onClose} onCreated={onCreated} groupSlug="test" />,
        { groupSlug: 'test' }
      )
    )

    await vi.waitFor(() => {
      expect(screen.getByText('What do you want to propose?')).toBeDefined()
    }, { timeout: 2000 })

    const types = ['Bug report', 'Improvement', 'New app', 'App feature', 'General functionality', 'Other']
    for (const t of types) {
      expect(screen.getByText(t)).toBeDefined()
    }
  })
})
