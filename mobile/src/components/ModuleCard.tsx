import { View, Text, TouchableOpacity } from 'react-native'

export interface ModuleCardProps {
  slug: string
  name: string
  description?: string
  icon?: string
  primaryColor?: string
  onPress: () => void
}

export function ModuleCard({
  slug: _slug,
  name,
  description,
  icon,
  primaryColor,
  onPress,
}: ModuleCardProps) {
  return (
    <TouchableOpacity
      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-lg items-center justify-center mr-3"
          style={{ backgroundColor: primaryColor ? primaryColor + '15' : '#9B1C1C15' }}
        >
          <Text className="text-lg">{icon ?? name.charAt(0)}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-secondary dark:text-gray-100">
            {name}
          </Text>
          {description ? (
            <Text className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              {description}
            </Text>
          ) : null}
        </View>
        <Text className="text-slate-300 dark:text-gray-600 text-lg">›</Text>
      </View>
    </TouchableOpacity>
  )
}
