import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { setServerUrl, getDefaultUrl } from '@/lib/server-url'

export default function WelcomeScreen() {
  const router = useRouter()

  const [showCustomUrl, setShowCustomUrl] = useState(false)
  const [customUrl, setCustomUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const saveAndRedirect = async (url: string) => {
    setError('')
    setIsSaving(true)
    await setServerUrl(url)
    router.replace('/')
  }

  const handleUseDefault = () => {
    saveAndRedirect(getDefaultUrl())
  }

  const handleCustomSave = () => {
    const trimmed = customUrl.trim()
    if (!trimmed) {
      setError('Please enter a server URL')
      return
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }
    saveAndRedirect(trimmed)
  }

  const handleCancelCustom = () => {
    setShowCustomUrl(false)
    setCustomUrl('')
    setError('')
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & Tagline */}
        <View className="items-center mb-10">
          <Text className="text-4xl font-bold text-[#9B1C1C] mb-3">027Apps</Text>
          <Text className="text-lg text-slate-500 text-center">
            Tu plataforma de apps en grupo
          </Text>
        </View>

        {!showCustomUrl ? (
          /* Default view: two options */
          <View>
            <TouchableOpacity
              className="bg-red-800 rounded-lg py-3 items-center mb-4"
              onPress={handleUseDefault}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Usar 027apps.com
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="border border-gray-300 rounded-lg py-3 items-center"
              onPress={() => setShowCustomUrl(true)}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text className="text-slate-700 text-base font-semibold">
                Mi propio servidor
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Custom URL input */
          <View>
            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-sm font-medium text-slate-700 mb-1">
                Server URL
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                placeholder="https://my-server.com"
                placeholderTextColor="#94A3B8"
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                autoComplete="url"
              />
            </View>

            <TouchableOpacity
              className="bg-red-800 rounded-lg py-3 items-center mb-3"
              onPress={handleCustomSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-base font-semibold">Conectar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="py-2 items-center"
              onPress={handleCancelCustom}
              disabled={isSaving}
            >
              <Text className="text-red-800 text-sm font-medium">Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
