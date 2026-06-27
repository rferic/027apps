import { View, Text, TextInput } from 'react-native'
import type { KeyboardTypeOptions } from 'react-native'

export interface DsInputProps {
  label?: string
  value: string
  onChangeText: (text: string) => void
  error?: string
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  multiline?: boolean
}

export function DsInput({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: DsInputProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </Text>
      ) : null}
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white bg-white dark:bg-gray-900 ${
          error
            ? 'border-red-500'
            : 'border-slate-200 dark:border-slate-700'
        } ${multiline ? 'min-h-[100]' : ''}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {error ? (
        <Text className="text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  )
}
