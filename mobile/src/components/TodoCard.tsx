import { View, Text, TouchableOpacity } from 'react-native'

export interface TodoCardProps {
  id: number
  title: string
  completed: boolean
  priority?: 'low' | 'medium' | 'high'
  createdAt: string
  onToggle: (id: number) => void
  onPress: (id: number) => void
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function TodoCard({ id, title, completed, priority, createdAt, onToggle, onPress }: TodoCardProps) {
  const date = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <TouchableOpacity
      className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-3"
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start">
        {/* Checkbox */}
        <TouchableOpacity
          className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 mt-0.5 ${
            completed ? 'bg-[#9B1C1C] border-[#9B1C1C]' : 'border-slate-300'
          }`}
          onPress={() => onToggle(id)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {completed && (
            <Text className="text-white text-xs font-bold">✓</Text>
          )}
        </TouchableOpacity>

        {/* Content */}
        <View className="flex-1">
          <Text
            className={`text-base font-semibold ${
              completed ? 'text-slate-400 line-through' : 'text-[#1E293B]'
            }`}
            numberOfLines={2}
          >
            {title}
          </Text>

          <View className="flex-row items-center mt-2 gap-2">
            {priority && (
              <View className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[priority]}`}>
                <Text className="text-xs font-medium">{PRIORITY_LABELS[priority]}</Text>
              </View>
            )}
            <Text className="text-xs text-slate-400">{date}</Text>
          </View>
        </View>

        {/* Chevron */}
        <Text className="text-slate-300 text-lg ml-2">›</Text>
      </View>
    </TouchableOpacity>
  )
}
