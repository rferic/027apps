import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import * as Constants from 'expo-constants'
import { useAuth } from '@/hooks/useAuth'
import { getServerUrl, setServerUrl, getDefaultUrl } from '@/lib/server-url'
import { getActiveGroupSlug } from '@/lib/group-store'

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()

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
    Alert.alert('Server URL updated', 'Restart the app for changes to take effect.')
  }

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        },
      },
    ])
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
          Account
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <Text className="text-sm text-slate-400">Email</Text>
          <Text className="text-base text-[#1E293B] mt-0.5">{user?.email ?? '—'}</Text>
        </View>
      </View>

      {/* Server */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Server
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
                    <Text className="text-white text-sm font-semibold">Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-slate-200 rounded-lg py-2 items-center"
                  onPress={() => setEditingUrl(false)}
                  activeOpacity={0.8}
                >
                  <Text className="text-slate-600 text-sm font-semibold">Cancel</Text>
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
              <Text className="text-sm text-slate-400">Server URL</Text>
              <Text className="text-base text-[#1E293B] mt-0.5">{serverUrl}</Text>
              <Text className="text-xs text-[#9B1C1C] mt-1">Tap to change</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active group */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Active Group
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <Text className="text-sm text-slate-400">Current group</Text>
          <Text className="text-base text-[#1E293B] mt-0.5">{activeGroup || 'Not selected'}</Text>
        </View>
      </View>

      {/* Theme placeholder */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Appearance
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-[#1E293B]">Theme</Text>
            <Text className="text-sm text-slate-400">Light</Text>
          </View>
          <View className="flex-row justify-between items-center mt-3">
            <Text className="text-base text-[#1E293B]">Language</Text>
            <Text className="text-sm text-slate-400">English</Text>
          </View>
        </View>
      </View>

      {/* About */}
      <View className="px-6 pt-6">
        <Text className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          About
        </Text>
        <View className="bg-slate-50 rounded-xl p-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-[#1E293B]">Version</Text>
            <Text className="text-sm text-slate-400">
              {appVersion} ({buildNumber})
            </Text>
          </View>
        </View>
        <Text className="text-xs text-slate-400 text-center mt-4">
          027apps — Family Hub Platform
        </Text>
      </View>

      {/* Sign Out */}
      <View className="px-6 pt-8 pb-8">
        <TouchableOpacity
          className="bg-red-50 border border-red-200 rounded-xl py-3 items-center"
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text className="text-red-600 text-base font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
