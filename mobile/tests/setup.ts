import { vi } from 'vitest'

// Mock expo-secure-store
vi.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve()
    }),
    deleteItemAsync: vi.fn((key: string) => {
      store.delete(key)
      return Promise.resolve()
    }),
  }
})

// Mock expo-local-authentication
vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn(() => Promise.resolve(true)),
  isEnrolledAsync: vi.fn(() => Promise.resolve(true)),
  authenticateAsync: vi.fn(() => Promise.resolve({ success: true })),
}))

// Mock expo-localization
vi.mock('expo-localization', () => ({
  getLocales: vi.fn(() => [{ languageCode: 'en' }]),
}))

// Mock react-native
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  ScrollView: 'ScrollView',
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn(() => Promise.resolve()) },
  Animated: {
    createAnimatedComponent: vi.fn((comp: unknown) => comp),
    View: 'Animated.View',
  },
  AppState: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  NativeModules: {},
}))

// Mock expo-router
vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  })),
  Link: 'Link',
  Stack: 'Stack',
}))

// Mock expo-constants
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: { version: '1.0.0' },
  },
}))

// Mock react-i18next (with initReactI18next for i18n.ts module init)
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal() as {
    useTranslation: unknown
    initReactI18next: unknown
    I18nextProvider: unknown
  }
  return {
    ...actual,
    useTranslation: vi.fn(() => ({
      t: vi.fn((key: string) => key),
      i18n: { language: 'en', changeLanguage: vi.fn() },
    })),
  }
})
