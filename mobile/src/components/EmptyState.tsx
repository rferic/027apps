import { View, Text, TouchableOpacity } from 'react-native'

export interface EmptyStateProps {
  title: string
  message?: string
  icon?: string
  action?: { label: string; onPress: () => void }
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {icon ? (
        <Text className="text-5xl mb-4">{icon}</Text>
      ) : null}
      <Text className="text-lg font-semibold text-secondary dark:text-gray-100 text-center mb-2">
        {title}
      </Text>
      {message ? (
        <Text className="text-sm text-slate-400 dark:text-slate-500 text-center mb-6">
          {message}
        </Text>
      ) : null}
      {action ? (
        <TouchableOpacity
          className="bg-primary rounded-xl px-6 py-3"
          onPress={action.onPress}
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-semibold">{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
