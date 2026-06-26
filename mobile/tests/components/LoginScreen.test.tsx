import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'

const mockSignIn = vi.fn()

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => `translated:${key}`),
  })),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    signIn: mockSignIn,
    signInWithBiometrics: vi.fn(),
    isLoading: false,
    isAuthenticated: false,
  })),
}))

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  Link: 'Link',
}))

vi.mock('@/lib/biometrics', () => ({
  isBiometricsAvailable: vi.fn(() => Promise.resolve(false)),
  authenticateWithBiometrics: vi.fn(() => Promise.resolve(true)),
}))

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignIn.mockResolvedValue({})
  })

  it('should export a default component', async () => {
    const module = await import('@app/login')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })

  it('should render without crashing', async () => {
    const { default: LoginScreen } = await import('@app/login')
    const element = createElement(LoginScreen)
    expect(element).toBeDefined()
    expect(element.type).toBe(LoginScreen)
  })

  it('should have signIn available via useAuth mock', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    const auth = useAuth()
    expect(auth.signIn).toBe(mockSignIn)
  })
})
