import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Constants from 'expo-constants'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'
import { getServerUrl, setServerUrl, getDefaultUrl } from '@/lib/server-url'
import { getActiveGroupSlug } from '@/lib/group-store'
import { setStoredLanguage } from '@/lib/i18n'
import { useNotifications } from '@/hooks/useNotifications'
import { requestNotificationPermissions } from '@/lib/notifications'

const LANGUAGES = [
  { code: 'en', key: 'mobile.locales.en' as const },
  { code: 'es', key: 'mobile.locales.es' as const },
  { code: 'it', key: 'mobile.locales.it' as const },
  { code: 'ca', key: 'mobile.locales.ca' as const },
  { code: 'fr', key: 'mobile.locales.fr' as const },
  { code: 'de', key: 'mobile.locales.de' as const },
] as const

export default function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { permissionGranted, pushToken } = useNotifications()

  const [serverUrl, setServerUrlState] = useState('')
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [savingUrl, setSavingUrl] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  useEffect(() => {
    getServerUrl().then((url) => {
      setServerUrlState(url || getDefaultUrl())
    })
    getActiveGroupSlug().then(setActiveGroup)
  }, [])

  const handleSaveUrl = async () => {
    if (!urlInput.trim()) return
    setSavingUrl(true)
    await setServerUrl(urlInput.trim())
    setServerUrlState(urlInput.trim())
    setEditingUrl(false)
    setSavingUrl(false)
    Alert.alert(t('mobile.settings.serverUpdated'), t('mobile.settings.restartMessage'))
  }

  const handleSignOut = async () => {
    Alert.alert(t('mobile.settings.signOut'), t('mobile.settings.signOutConfirm'), [
      { text: t('mobile.settings.signOutCancel'), style: 'cancel' },
      {
        text: t('mobile.settings.signOutAction'),
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        },
      },
    ])
  }

  const handleLanguageChange = (lang: string) => {
    setStoredLanguage(lang)
  }

  const appVersion = Constants.default?.expoConfig?.version ?? '1.0.0'
  const buildNumber =
    Constants.default?.expoConfig?.ios?.buildNumber ??
    Constants.default?.expoConfig?.android?.versionCode ??
    '1'

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Account */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.accountSection')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <Text className="text-sm text-slate-400">{t('mobile.settings.email')}</Text>
          <Text className="text-base text-[#1E293B] mt-0.5">{user?.email ?? '—'}</Text>
        </View>
      </View>

      {/* Server */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.serverSection')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          {editingUrl ? (
            <View>
              <TextInput
                className="border border-slate-300 rounded-lg px-3 py-2 text-base text-[#1E293B] bg-white"
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="https://..."
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View className="flex-row mt-3 gap-2">
                <TouchableOpacity
                  className="flex-1 bg-[#9B1C1C] rounded-lg py-2 items-center"
                  onPress={handleSaveUrl}
                  disabled={savingUrl}
                  activeOpacity={0.8}
                >
                  {savingUrl ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">{t('mobile.settings.save')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-slate-200 rounded-lg py-2 items-center"
                  onPress={() => setEditingUrl(false)}
                  activeOpacity={0.8}
                >
                  <Text className="text-slate-600 text-sm font-semibold">{t('mobile.settings.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setUrlInput(serverUrl)
                setEditingUrl(true)
              }}
              activeOpacity={0.7}
            >
              <Text className="text-sm text-slate-400">{t('mobile.settings.serverUrl')}</Text>
              <Text className="text-base text-[#1E293B] mt-0.5">{serverUrl}</Text>
              <Text className="text-xs text-[#9B1C1C] mt-1">{t('mobile.settings.tapToChange')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active group */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.activeGroup')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <Text className="text-sm text-slate-400">{t('mobile.settings.currentGroup')}</Text>
          <Text className="text-base text-[#1E293B] mt-0.5">{activeGroup || t('mobile.settings.notSelected')}</Text>
        </View>
      </View>

      {/* Notifications */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.notifications')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <View className="flex-1 mr-3">
              <Text className="text-base text-[#1E293B]">{t('mobile.settings.pushNotifications')}</Text>
              <Text className="text-xs text-slate-400 mt-0.5">
                {permissionGranted
                  ? t('mobile.settings.notificationsEnabled')
                  : t('mobile.settings.notificationsDisabled')}
              </Text>
            </View>
            {permissionGranted ? (
              <Text className="text-sm font-medium text-green-600">{t('mobile.settings.active')}</Text>
            ) : (
              <TouchableOpacity
                className="bg-[#9B1C1C] rounded-lg px-4 py-2"
                onPress={async () => {
                  const granted = await requestNotificationPermissions()
                  if (granted) {
                    Alert.alert(t('mobile.settings.success'), t('mobile.settings.notificationsEnabledMsg'))
                  } else {
                    Alert.alert(
                      t('mobile.settings.permissionDenied'),
                      t('mobile.settings.notificationsEnableHint'),
                    )
                  }
                }}
                activeOpacity={0.8}
              >
                <Text className="text-white text-sm font-semibold">{t('mobile.settings.enable')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {pushToken && (
            <View className="mt-3 pt-3 border-t border-slate-200">
              <Text className="text-xs text-slate-400">Push Token</Text>
              <Text className="text-xs text-slate-500 mt-0.5" numberOfLines={1}>
                {pushToken.slice(0, 24)}...
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Appearance & Language */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.appearance')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-[#1E293B]">{t('mobile.settings.theme')}</Text>
            <Text className="text-sm text-slate-400">{t('mobile.settings.light')}</Text>
          </View>
          <View className="mt-3">
            <Text className="text-base text-[#1E293B] mb-2">{t('mobile.settings.languageLabel')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {LANGUAGES.map(({ code, key }) => (
                <TouchableOpacity
                  key={code}
                  className={`rounded-lg px-3 py-1.5 ${
                    i18n.language === code
                      ? 'bg-[#9B1C1C]'
                      : 'bg-slate-200'
                  }`}
                  onPress={() => handleLanguageChange(code)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-sm font-medium ${
                      i18n.language === code ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {t(key)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* About */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          {t('mobile.settings.about')}
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-[#1E293B]">{t('mobile.settings.version')}</Text>
            <Text className="text-sm text-slate-400">
              {appVersion} ({buildNumber})
            </Text>
          </View>
        </View>
        <Text className="text-xs text-slate-400 text-center mt-4">
          {t('mobile.settings.footer')}
        </Text>
      </View>

      {/* Sign Out */}
      <View className="px-6 pt-8 pb-8">
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-xl py-3 items-center"
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text className="text-red-600 text-base font-semibold">{t('mobile.settings.signOut')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
