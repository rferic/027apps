import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { APP_NAME, BRAND_COLOR } from '@/lib/beta'

export default function RegisterScreen() {
  const router = useRouter()
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isPasswordValid = password.length >= 6
  const doPasswordsMatch = password === confirmPassword

  const handleSignUp = async () => {
    setError('')
    setSuccess('')

    if (!isEmailValid) {
      setError('Please enter a valid email address')
      return
    }
    if (!isPasswordValid) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!doPasswordsMatch) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    const { error, requiresConfirmation } = await signUp(email.trim(), password)
    if (error) {
      setError(error)
      setIsSubmitting(false)
      return
    }

    if (requiresConfirmation) {
      setSuccess('Account created! Check your email to confirm your address.')
      setIsSubmitting(false)
    } else {
      router.replace('/(app)/dashboard')
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
          <Text className="text-3xl font-bold" style={{ color: BRAND_COLOR }}>{APP_NAME}</Text>
          <Text className="text-base text-slate-500 mt-2">Create your account</Text>
        </View>

        {error ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-green-700 text-sm">{success}</Text>
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

        <View className="mb-4">
          <Text className="text-sm font-medium text-slate-700 mb-1">Password</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
            placeholder="At least 6 characters"
            placeholderTextColor="#94A3B8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-medium text-slate-700 mb-1">Confirm password</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
            placeholder="Re-enter your password"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
        </View>

        <TouchableOpacity
          className="bg-red-800 rounded-lg py-3 items-center mb-6"
          onPress={handleSignUp}
          disabled={isSubmitting || !email || !password || !confirmPassword}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">Create account</Text>
          )}
        </TouchableOpacity>

        <View className="items-center">
          <Link href="/login" className="py-2">
            <Text className="text-red-800 text-sm font-medium">
              Already have an account? Sign in
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
