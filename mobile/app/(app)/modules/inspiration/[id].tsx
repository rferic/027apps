import { useLocalSearchParams } from 'expo-router'
import { View, Text } from 'react-native'

export default function IdeaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg text-gray-500">Idea #{id}</Text>
      <Text className="text-sm text-gray-400 mt-2">Coming soon</Text>
    </View>
  )
}
