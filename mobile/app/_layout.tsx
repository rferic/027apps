import type { ReactNode } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { I18nextProvider } from 'react-i18next'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/lib/theme'
import { OfflineBanner } from '@/components/OfflineBanner'
import i18n from '@/lib/i18n'
import { useNotifications } from '@/hooks/useNotifications'
import '../global.css'

function NotificationInitializer({ children }: { children: ReactNode }) {
  useNotifications()
  return <>{children}</>
}

export default function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <ThemeProvider>
          <NotificationInitializer>
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
          </NotificationInitializer>
        </ThemeProvider>
      </AuthProvider>
    </I18nextProvider>
  )
}
