import { useEffect, type ReactNode } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { OfflineBanner } from '@/components/OfflineBanner'
import i18n from '@/lib/i18n'
import { useNotifications } from '@/hooks/useNotifications'
import { parseDeepLink } from '@/lib/deep-links'
import { initModuleRegistry } from '@/lib/modules'
import '../global.css'

initModuleRegistry()

function NotificationInitializer({ children }: { children: ReactNode }) {
  useNotifications()
  return <>{children}</>
}

function DeepLinkHandler({ children }: { children: ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Handle incoming deep links when app is already running
    const sub = Linking.addEventListener('url', (event) => {
      const parsed = parseDeepLink(event.url)
      if (!parsed) return

      // Map update-password to reset-password for compatibility
      const route =
        parsed.route === 'update-password' ? 'reset-password' : parsed.route

      const params = new URLSearchParams(parsed.params).toString()
      const path = params ? `/${route}?${params}` : `/${route}`
      router.push(path as any)
    })

    return () => sub.remove()
  }, [router])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ThemeProvider>
          <NotificationInitializer>
            <DeepLinkHandler>
              <StatusBar style="auto" />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="reset-password" />
                <Stack.Screen name="(app)" />
              </Stack>
            </DeepLinkHandler>
          </NotificationInitializer>
        </ThemeProvider>
      </AuthProvider>
    </I18nextProvider>
  )
}
