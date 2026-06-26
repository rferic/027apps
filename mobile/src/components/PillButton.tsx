import { Text, TouchableOpacity } from 'react-native'

export interface PillButtonProps {
  label: string
  active: boolean
  onPress: () => void
  count?: number
}

export function PillButton({ label, active, onPress, count }: PillButtonProps) {
  return (
    <TouchableOpacity
      className={`rounded-full px-4 py-2 flex-row items-center gap-1.5 ${
        active
          ? 'bg-primary'
          : 'bg-gray-100 dark:bg-gray-800'
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        className={`text-sm font-medium ${
          active
            ? 'text-white'
            : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {count}
        </Text>
      ) : null}
    </TouchableOpacity>
  )
}
