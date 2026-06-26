import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

const MODULES = [
  { slug: 'todo', name: 'TODO', description: 'Task management', color: '#0EA5E9' },
  { slug: 'inspiration', name: 'Inspiration', description: 'Capture and vote on ideas', color: '#8B5CF6' },
]

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuth()

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Welcome header */}
      <View className="px-6 pt-6 pb-2">
        <Text className="text-2xl font-bold text-[#1E293B]">Dashboard</Text>
        {user?.email && (
          <Text className="text-sm text-slate-400 mt-1">{user.email}</Text>
        )}
      </View>

      {/* Modules section */}
      <View className="px-6 pt-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-[#1E293B]">Modules</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/modules')} activeOpacity={0.7}>
            <Text className="text-sm text-[#9B1C1C] font-medium">See all</Text>
          </TouchableOpacity>
        </View>

        {MODULES.length === 0 ? (
          <View className="bg-slate-50 rounded-xl p-8 items-center">
            <Text className="text-slate-400 text-base text-center">No modules installed</Text>
          </View>
        ) : (
          <View className="gap-3">
            {MODULES.map((mod) => (
              <TouchableOpacity
                key={mod.slug}
                className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm"
                onPress={() => router.push(`/(app)/modules/${mod.slug}`)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: mod.color + '15' }}
                  >
                    <Text className="text-lg">{mod.slug === 'todo' ? '✅' : '💡'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-[#1E293B]">{mod.name}</Text>
                    <Text className="text-sm text-slate-400">{mod.description}</Text>
                  </View>
                  <Text className="text-slate-300 text-lg">›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Quick action: Go to modules */}
      <View className="px-6 pt-6">
        <TouchableOpacity
          className="bg-[#9B1C1C] rounded-xl py-3 items-center"
          onPress={() => router.push('/(app)/modules')}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-semibold">Go to Apps</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
