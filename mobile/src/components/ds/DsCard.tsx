import { View, TouchableOpacity } from 'react-native'
import type { ReactNode } from 'react'

export interface DsCardProps {
  children: ReactNode
  padding?: 'sm' | 'md' | 'lg'
  onPress?: () => void
}

const paddingClasses: Record<NonNullable<DsCardProps['padding']>, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function DsCard({ children, padding = 'md', onPress }: DsCardProps) {
  const className = `bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 rounded-xl ${paddingClasses[padding]}`

  if (onPress) {
    return (
      <TouchableOpacity className={className} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    )
  }

  return <View className={className}>{children}</View>
}
