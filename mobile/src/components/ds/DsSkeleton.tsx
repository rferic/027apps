// DsSkeleton is for INLINE skeletal loading (individual blocks).
// For full page/component loading states, use LoadingSkeleton in mobile/src/components/LoadingSkeleton.tsx
import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

export interface DsSkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
}

export function DsSkeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
}: DsSkeletonProps) {
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
      className="bg-slate-200 dark:bg-gray-700"
      style={{
        width: width as number,
        height,
        borderRadius,
        opacity,
      }}
    />
  )
}
