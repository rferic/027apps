import { View, Text } from 'react-native'

interface CommentItemProps {
  id: string
  author: string
  body: string
  createdAt: string
  avatarUrl?: string | null
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function CommentItem({ author, body, createdAt }: CommentItemProps) {
  const initial = (author || '?')[0].toUpperCase()

  return (
    <View className="flex-row gap-2.5 py-3">
      <View className="w-8 h-8 rounded-full bg-amber-500/10 items-center justify-center">
        <Text className="text-sm font-bold text-amber-600">{initial}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-sm font-semibold text-slate-800">{author}</Text>
          <Text className="text-xs text-slate-400">{formatTimeAgo(createdAt)}</Text>
        </View>
        <Text className="text-sm text-slate-600 leading-5">{body}</Text>
      </View>
    </View>
  )
}
