import { useEffect } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function IndexScreen() {
  const router = useRouter()
  const { isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.replace('/login')
    } else {
      router.replace('/(app)/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-3xl font-bold text-[#9B1C1C] mb-3">027Apps</Text>
      <Text className="text-base text-slate-500 mb-6">Mobile App</Text>
      <ActivityIndicator size="large" color="#9B1C1C" />
    </View>
  )
}
