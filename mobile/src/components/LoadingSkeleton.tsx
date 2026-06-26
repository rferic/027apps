import { useEffect, useRef } from 'react'
import { View, Animated } from 'react-native'

export interface LoadingSkeletonProps {
  type: 'card' | 'list' | 'detail'
  count?: number
}

function SkeletonBlock({ className }: { className: string }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <Animated.View
      className={`bg-slate-200 dark:bg-gray-700 rounded-lg ${className}`}
      style={{ opacity }}
    />
  )
}

export function LoadingSkeleton({ type, count = 3 }: LoadingSkeletonProps) {
  if (type === 'card') {
    return (
      <View className="gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <View
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4"
          >
            <View className="flex-row items-center">
              <SkeletonBlock className="w-10 h-10 mr-3" />
              <View className="flex-1 gap-2">
                <SkeletonBlock className="h-4 w-3/5" />
                <SkeletonBlock className="h-3 w-2/5" />
              </View>
              <SkeletonBlock className="w-4 h-4" />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (type === 'list') {
    return (
      <View className="gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} className="flex-row items-center py-2 px-1 gap-3">
            <SkeletonBlock className="w-5 h-5 rounded-full" />
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-3 w-12" />
          </View>
        ))}
      </View>
    )
  }

  // detail
  return (
    <View className="gap-6 px-4 pt-6">
      <SkeletonBlock className="h-8 w-3/4" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-4/6" />
      <View className="mt-4 gap-3">
        <SkeletonBlock className="h-24 w-full rounded-xl" />
        <SkeletonBlock className="h-24 w-full rounded-xl" />
      </View>
    </View>
  )
}
