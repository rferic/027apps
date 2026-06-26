import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function DashboardScreen() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <View className="flex-1 bg-white p-6 justify-center items-center">
      <Text className="text-2xl font-bold text-[#1E293B] mb-3">Dashboard</Text>
      <Text className="text-base text-slate-500 mb-8">
        Welcome{user?.email ? `, ${user.email}` : ''}
      </Text>

      <TouchableOpacity
        className="bg-red-800 rounded-lg py-3 px-8 items-center"
        onPress={handleSignOut}
        activeOpacity={0.8}
      >
        <Text className="text-white text-base font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}
