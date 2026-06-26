import { View, Text, ScrollView } from 'react-native'
import { useNotifications } from '@/hooks/useNotifications'

export default function NotificationsScreen() {
  const { lastNotification } = useNotifications()

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-6 pt-6">
        <Text className="text-xl font-bold text-[#1E293B] mb-2">Notifications</Text>
        <Text className="text-sm text-slate-400 mb-6">Recent activity and updates</Text>

        {lastNotification ? (
          <View className="bg-slate-50 rounded-xl p-4">
            <Text className="text-sm font-semibold text-[#1E293B]">
              {lastNotification.title}
            </Text>
            <Text className="text-sm text-slate-600 mt-1">
              {lastNotification.body}
            </Text>
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-4xl mb-4">🔔</Text>
            <Text className="text-base text-slate-400 text-center">
              No notifications yet
            </Text>
            <Text className="text-sm text-slate-300 text-center mt-1">
              Notifications will appear here when you receive updates
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
