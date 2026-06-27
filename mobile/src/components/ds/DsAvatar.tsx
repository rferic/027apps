import { View, Text } from 'react-native'

export interface DsAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses: Record<NonNullable<DsAvatarProps['size']>, { container: string; text: string }> = {
  sm: { container: 'w-8 h-8 rounded-lg', text: 'text-xs font-semibold' },
  md: { container: 'w-10 h-10 rounded-lg', text: 'text-sm font-semibold' },
  lg: { container: 'w-14 h-14 rounded-lg', text: 'text-lg font-semibold' },
}

const colors = [
  'bg-red-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getColorIndex(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % colors.length
}

export function DsAvatar({ name, size = 'md' }: DsAvatarProps) {
  const { container, text } = sizeClasses[size]
  const colorClass = colors[getColorIndex(name)]

  return (
    <View className={`${container} ${colorClass} items-center justify-center`}>
      <Text className={`text-white ${text}`}>{getInitials(name)}</Text>
    </View>
  )
}
