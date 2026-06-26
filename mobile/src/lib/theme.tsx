import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { View } from 'react-native'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)
const THEME_KEY = '027apps_theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme()
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
      }
    })
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system'
      ? (systemColorScheme === 'dark' ? 'dark' : 'light')
      : theme

  const isDark = resolvedTheme === 'dark'

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    SecureStore.setItemAsync(THEME_KEY, newTheme).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, isDark }}>
      <View className={isDark ? 'dark flex-1' : 'flex-1'}>
        {children}
      </View>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
