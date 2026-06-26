import { useRef, useCallback } from 'react'
import { TouchableOpacity, Text, Animated } from 'react-native'

interface VoteButtonProps {
  count: number
  hasVoted: boolean
  onPress: () => void
  loading?: boolean
}

export function VoteButton({ count, hasVoted, onPress, loading }: VoteButtonProps) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePress = useCallback(() => {
    if (loading) return
    // Bounce animation
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, speed: 20 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12 }),
    ]).start()
    onPress()
  }, [loading, onPress, scale])

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={loading}
      className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg ${
        hasVoted ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'
      }`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text className={`text-base ${hasVoted ? 'text-red-500' : 'text-slate-400'}`}>
          {hasVoted ? '\u2665' : '\u2661'}
        </Text>
      </Animated.View>
      <Text className={`text-sm font-semibold ${hasVoted ? 'text-red-500' : 'text-slate-500'}`}>
        {count}
      </Text>
    </TouchableOpacity>
  )
}
