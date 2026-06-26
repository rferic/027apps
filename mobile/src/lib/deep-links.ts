import * as Linking from 'expo-linking'

// URL prefix for deep links generated within the app
const prefix = Linking.createURL('/')

export const linking = {
  prefixes: [prefix, 'https://027apps.com', 'https://*.027apps.com'],
  config: {
    screens: {
      'reset-password': 'reset-password',
      '(app)': {
        screens: {
          modules: {
            screens: {
              inspiration: {
                screens: {
                  '[id]': 'inspiration/:id',
                },
              },
              todo: {
                screens: {
                  '[id]': 'todo/:id',
                },
              },
            },
          },
        },
      },
    },
  },
}

// Supported URL schemes:
// 027apps://                     → root (index)
// 027apps://reset-password?code=xxx → password reset screen
// 027apps://(app)/modules/inspiration/:id → inspiration detail
// 027apps://(app)/modules/todo/:id → todo detail

export function parseDeepLink(url: string): {
  route: string
  params: Record<string, string>
} | null {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/^\//, '')
    const params: Record<string, string> = {}
    parsed.searchParams.forEach((value, key) => {
      params[key] = value
    })
    return { route: path, params }
  } catch {
    return null
  }
}
