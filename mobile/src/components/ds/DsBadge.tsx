import { View, Text } from 'react-native'

export interface DsBadgeProps {
  label: string
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral'
}

const bgClasses: Record<NonNullable<DsBadgeProps['variant']>, string> = {
  primary: 'bg-primary/10',
  success: 'bg-emerald-500/10',
  warning: 'bg-amber-500/10',
  error: 'bg-red-500/10',
  neutral: 'bg-slate-100 dark:bg-slate-800',
}

const textClasses: Record<NonNullable<DsBadgeProps['variant']>, string> = {
  primary: 'text-primary',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  neutral: 'text-slate-600 dark:text-slate-400',
}

export function DsBadge({ label, variant = 'neutral' }: DsBadgeProps) {
  return (
    <View className={`self-start rounded-lg px-2.5 py-0.5 ${bgClasses[variant]}`}>
      <Text className={`text-xs font-semibold ${textClasses[variant]}`}>{label}</Text>
    </View>
  )
}
