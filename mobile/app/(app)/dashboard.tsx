import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'
import { ModuleCard } from '@/components/ModuleCard'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const MODULES = [
  { slug: 'todo', name: 'TODO', description: 'Task management', color: '#0EA5E9', icon: '✅' },
  { slug: 'inspiration', name: 'Inspiration', description: 'Capture and vote on ideas', color: '#8B5CF6', icon: '💡' },
]

export default function DashboardScreen() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-white dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-6 pb-2">
          <Text className="text-2xl font-bold text-secondary dark:text-gray-100">Dashboard</Text>
        </View>
        <View className="px-6 pt-4">
          <Text className="text-lg font-semibold text-secondary dark:text-gray-100 mb-3">Modules</Text>
          <LoadingSkeleton type="card" count={3} />
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Welcome header */}
      <View className="px-6 pt-6 pb-2">
        <Text className="text-2xl font-bold text-secondary dark:text-gray-100">Dashboard</Text>
        {user?.email && (
          <Text className="text-sm text-slate-400 dark:text-slate-500 mt-1">{user.email}</Text>
        )}
      </View>

      {/* Modules section */}
      <View className="px-6 pt-4">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-lg font-semibold text-secondary dark:text-gray-100">Modules</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/modules')} activeOpacity={0.7}>
            <Text className="text-sm text-primary font-medium">See all</Text>
          </TouchableOpacity>
        </View>

        {MODULES.length === 0 ? (
          <EmptyState
            title="No modules installed"
            icon="📦"
            action={{ label: 'Browse Apps', onPress: () => router.push('/(app)/modules') }}
          />
        ) : (
          <View className="gap-3">
            {MODULES.map((mod) => (
              <ModuleCard
                key={mod.slug}
                slug={mod.slug}
                name={mod.name}
                description={mod.description}
                icon={mod.icon}
                primaryColor={mod.color}
                onPress={() => router.push(`/(app)/modules/${mod.slug}`)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Quick action: Go to modules */}
      <View className="px-6 pt-6">
        <TouchableOpacity
          className="bg-primary rounded-xl py-3 items-center"
          onPress={() => router.push('/(app)/modules')}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-semibold">Go to Apps</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
