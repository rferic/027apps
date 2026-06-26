import { useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import * as Network from 'expo-network'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const state = await Network.getNetworkStateAsync()
        if (!cancelled) {
          setIsOffline(!state.isConnected)
        }
      } catch {
        // ignore errors, assume online
      }
    }

    check()
    const interval = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!isOffline) return null

  return (
    <View className="bg-amber-500 px-4 py-2 items-center">
      <Text className="text-amber-900 text-sm font-medium">
        You are offline
      </Text>
    </View>
  )
}
