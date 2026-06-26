import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { hasServerUrl } from '@/lib/server-url'

export default function IndexScreen() {
  const router = useRouter()
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth()

  const [checkingUrl, setCheckingUrl] = useState(true)
  const [hasUrl, setHasUrl] = useState(false)

  useEffect(() => {
    hasServerUrl().then((result) => {
      setHasUrl(result)
      setCheckingUrl(false)
    })
  }, [])

  useEffect(() => {
    if (checkingUrl || isAuthLoading) return

    if (!hasUrl) {
      router.replace('/welcome')
    } else if (!isAuthenticated) {
      router.replace('/login')
    } else {
      router.replace('/(app)/dashboard')
    }
  }, [checkingUrl, isAuthLoading, hasUrl, isAuthenticated, router])

  const isLoading = checkingUrl || isAuthLoading

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold text-[#9B1C1C] mb-3">027Apps</Text>
      <Text className="text-base text-slate-500 mb-6">Mobile App</Text>
      <ActivityIndicator size="large" color="#9B1C1C" />
    </View>
  )
}
