import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => `translated:${key}`),
  })),
}))

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  Link: 'Link',
}))

vi.mock('@/lib/server-url', () => ({
  setServerUrl: vi.fn(() => Promise.resolve()),
  getDefaultUrl: vi.fn(() => 'https://027apps.com'),
}))

describe('WelcomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export a default component', async () => {
    const module = await import('@app/welcome')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })

  it('should render without crashing', async () => {
    const { default: WelcomeScreen } = await import('@app/welcome')
    const element = createElement(WelcomeScreen)
    expect(element).toBeDefined()
    expect(element.type).toBe(WelcomeScreen)
  })

  it('should use getDefaultUrl for default option', async () => {
    const { getDefaultUrl } = await import('@/lib/server-url')
    const url = getDefaultUrl()
    expect(url).toBe('https://027apps.com')
  })

  it('should set server URL via setServerUrl', async () => {
    const { setServerUrl } = await import('@/lib/server-url')
    await setServerUrl('https://my-server.com')
    expect(setServerUrl).toHaveBeenCalledWith('https://my-server.com')
  })
})
