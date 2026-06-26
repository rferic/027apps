import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Link, useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordScreen() {
  const router = useRouter()
  // code comes from deep links: 027apps://reset-password?code=xxx
  const { code } = useLocalSearchParams<{ code?: string }>()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleResetPassword = async () => {
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setIsSubmitting(false)
      return
    }

    setSuccess('Password updated successfully!')
    setIsSubmitting(false)

    setTimeout(() => {
      router.replace('/login')
    }, 2000)
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
          <Text className="text-base text-slate-500 mt-2">Set new password</Text>
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
          <Text className="text-sm font-medium text-slate-700 mb-1">New password</Text>
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
          <Text className="text-sm font-medium text-slate-700 mb-1">Confirm new password</Text>
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
          onPress={handleResetPassword}
          disabled={isSubmitting || !password || !confirmPassword}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-base font-semibold">Update password</Text>
          )}
        </TouchableOpacity>

        <View className="items-center">
          <Link href="/login" className="py-2">
            <Text className="text-red-800 text-sm font-medium">
              Back to sign in
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
