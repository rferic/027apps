const VARIANT = process.env.EXPO_PUBLIC_APP_VARIANT ?? 'production'

const isBeta = VARIANT === 'beta'

export default {
  expo: {
    name: isBeta ? '027Apps Beta' : '027Apps',
    slug: isBeta ? '027apps-beta' : '027apps',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: isBeta ? '027apps-beta' : '027apps',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: isBeta ? 'com.rferic.apps027.beta' : 'com.rferic.apps027',
      associatedDomains: isBeta ? [] : ['applinks:027apps.com'],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: isBeta ? 'com.rferic.apps027.beta' : 'com.rferic.apps027',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: !isBeta,
          data: [
            {
              scheme: isBeta ? '027apps-beta' : '027apps',
              host: '*',
              pathPrefix: '/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-local-authentication',
      'expo-localization',
      'expo-notifications',
      'expo-updates',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: false,
      },
      appVariant: isBeta ? 'beta' : 'production',
      defaultApiUrl: isBeta
        ? process.env.EXPO_PUBLIC_BETA_API_URL ?? 'https://027apps.vercel.app'
        : 'https://027apps.com',
    },
    updates: {
      url: `https://u.expo.dev/${isBeta ? process.env.EXPO_PUBLIC_EAS_PROJECT_ID_BETA : process.env.EXPO_PUBLIC_EAS_PROJECT_ID}`,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
}
