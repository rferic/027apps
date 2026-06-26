import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { isBiometricsAvailable, authenticateWithBiometrics } from '@/lib/biometrics'

export default function LoginScreen() {
  const router = useRouter()
  const { signIn, signInWithBiometrics } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [biometricsReady, setBiometricsReady] = useState(false)

  // Check biometrics availability on mount
  useState(() => {
    isBiometricsAvailable().then(setBiometricsReady)
  })

  const handleSignIn = async () => {
    setError('')
    setIsSubmitting(true)

    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError(error)
      setIsSubmitting(false)
      return
    }

    router.replace('/(app)/dashboard')
  }

  const handleBiometricSignIn = async () => {
    setError('')
    const success = await authenticateWithBiometrics()
    if (!success) {
      setError('Biometric authentication failed')
      return
    }

    setIsSubmitting(true)
    const { error } = await signInWithBiometrics()
    if (error) {
      setError(error)
      setIsSubmitting(false)
      return
    }

    router.replace('/(app)/dashboard')
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
          <Text className="text-base text-slate-500 mt-2">Sign in to your account</Text>
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <View className="mb-4">
          <Text className="text-sm font-medium text-slate-700 mb-1">Email</Text>
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
          <Text className="text-sm font-medium text-slate-700 mb-1">Password</Text>
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
            <Text className="text-white text-base font-semibold">Sign In</Text>
          )}
        </TouchableOpacity>

        {biometricsReady && (
          <TouchableOpacity
            className="bg-slate-100 rounded-lg py-3 items-center mb-4"
            onPress={handleBiometricSignIn}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text className="text-slate-700 text-base font-semibold">
              Sign In with Biometrics
            </Text>
          </TouchableOpacity>
        )}

        <View className="flex-row justify-between">
          <Link href="/reset-password" className="py-2">
            <Text className="text-red-800 text-sm font-medium">Forgot password?</Text>
          </Link>
          <Link href="/register" className="py-2">
            <Text className="text-red-800 text-sm font-medium">Create account</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
