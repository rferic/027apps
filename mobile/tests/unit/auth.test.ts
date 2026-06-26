import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock React hooks to work without a renderer
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
    useEffect: vi.fn(),
    useCallback: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
    useContext: vi.fn((ctx: unknown) => {
      // For AuthContext, return a mock context value
      const ctxAny = ctx as { _currentValue?: unknown }
      return ctxAny._currentValue ?? null
    }),
  }
})

const mockGetSession = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: vi.fn(() => Promise.resolve({})),
      resetPasswordForEmail: vi.fn(() => Promise.resolve({})),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}))

import { AuthProvider, AuthContext } from '@/lib/auth'
import { createElement } from 'react'

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: null },
    })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  it('should be a function component', () => {
    expect(typeof AuthProvider).toBe('function')
  })

  it('should create a React element', () => {
    const element = createElement(AuthProvider, null, 'child')
    expect(element).toBeDefined()
    expect(element.type).toBe(AuthProvider)
  })

  it('should render AuthContext.Provider internally', () => {
    const rendered = AuthProvider({ children: 'test-child' })
    expect(rendered).toBeDefined()
    expect(rendered.type).toBe(AuthContext.Provider)
  })

  it('should have isLoading true in initial state', () => {
    const rendered = AuthProvider({ children: null })
    const value = rendered.props.value
    expect(value.isLoading).toBe(true)
    expect(value.isAuthenticated).toBe(false)
  })

  it('should handle successful signIn', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: null,
    })

    const rendered = AuthProvider({ children: null })
    const { signIn } = rendered.props.value

    const result = await signIn('test@test.com', 'password')
    expect(result.error).toBeUndefined()
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password',
    })
  })

  it('should handle failed signIn', async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: 'Invalid credentials' },
    })

    const rendered = AuthProvider({ children: null })
    const { signIn } = rendered.props.value

    const result = await signIn('bad@test.com', 'wrong')
    expect(result.error).toBe('Invalid credentials')
  })

  it('should call signOut on supabase', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const rendered = AuthProvider({ children: null })
    const { signOut } = rendered.props.value

    await signOut()
    expect(mockSignOut).toHaveBeenCalled()
  })
})
