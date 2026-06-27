import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native'
import { Link, useRouter, useLocalSearchParams } from 'expo-router'
import { useTranslation } from '@/hooks/useTranslation'
import { useAuth } from '@/hooks/useAuth'

export default function LoginScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { paired, email: pairedEmail } = useLocalSearchParams<{ paired?: string; email?: string }>()
  const { signIn, resetPassword } = useAuth()

  const [email, setEmail] = useState(pairedEmail ?? '')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async () => {
    setError('')
    setIsSubmitting(true)

    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) {
      setError(signInError)
      setIsSubmitting(false)
      return
    }

    router.replace('/(app)/dashboard')
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email first')
      return
    }
    setError('')
    const { error: resetErr } = await resetPassword(email.trim())
    if (resetErr) {
      setError(resetErr)
    } else {
      Alert.alert('Check your email', 'A password reset link has been sent.')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <Text className="text-3xl font-bold text-[#9B1C1C]">027Apps</Text>
          <Text className="text-base text-slate-500 mt-2">{t('auth.subtitle')}</Text>
        </View>

        {paired === 'true' && (
          <View className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-emerald-800 text-sm text-center">
              QR scanned successfully! Enter your password to complete login.
            </Text>
          </View>
        )}

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="text-sm font-medium text-slate-700 mb-1">{t('auth.email')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
            placeholder="your@email.com"
            placeholderTextColor="#94A3B8"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-slate-700 mb-1">{t('auth.password')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
            placeholder="Your password"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          className="bg-red-800 rounded-lg py-3 items-center mb-4"
          onPress={handleSignIn}
          disabled={isSubmitting || !email || !password}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">{t('auth.login')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="border border-slate-200 rounded-lg py-3 items-center mb-4"
          onPress={() => router.push('/pair-qr')}
          activeOpacity={0.8}
        >
          <Text className="text-slate-700 text-base font-semibold">Scan QR to login</Text>
        </TouchableOpacity>

        <View className="flex-row justify-between">
          <TouchableOpacity onPress={handleForgotPassword} className="py-2">
            <Text className="text-red-800 text-sm font-medium">{t('auth.forgot_password')}</Text>
          </TouchableOpacity>
          <Link href="/register" className="py-2">
            <Text className="text-red-800 text-sm font-medium">{t('mobile.auth.createAccount')}</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
