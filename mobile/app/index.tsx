import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import Constants from 'expo-constants'
import { useAuth } from '@/hooks/useAuth'
import { hasServerUrl } from '@/lib/server-url'
import { checkAppVersion, isUpdateRequired } from '@/lib/version-check'
import { UpdateRequiredScreen } from '@/components/UpdateRequiredScreen'
import { APP_NAME, BRAND_COLOR } from '@/lib/beta'

interface VersionInfo {
  latest_version: string
  min_version: string
  download_url: string
  release_notes: string | null
}

export default function IndexScreen() {
  const router = useRouter()
  const { isLoading: isAuthLoading, isAuthenticated } = useAuth()

  const [checkingUrl, setCheckingUrl] = useState(true)
  const [hasUrl, setHasUrl] = useState(false)
  const [checkingVersion, setCheckingVersion] = useState(true)
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null)

  useEffect(() => {
    hasServerUrl().then((result) => {
      setHasUrl(result)
      setCheckingUrl(false)
    })
  }, [])

  useEffect(() => {
    if (checkingUrl) return
    if (!hasUrl) {
      setCheckingVersion(false)
      return
    }

    checkAppVersion().then((info) => {
      setUpdateInfo(info)
      setCheckingVersion(false)
    })
  }, [checkingUrl, hasUrl])

  useEffect(() => {
    if (checkingUrl || isAuthLoading || checkingVersion) return

    // Check for forced update before anything else
    if (updateInfo) {
      const currentVersion = Constants.expoConfig?.version ?? '1.0.0'
      if (isUpdateRequired(currentVersion, updateInfo.min_version)) {
        // Don't redirect — UpdateRequiredScreen handles it
        return
      }
    }

    if (!hasUrl) {
      router.replace('/welcome')
    } else if (!isAuthenticated) {
      router.replace('/login')
    } else {
      router.replace('/(app)/dashboard')
    }
  }, [checkingUrl, isAuthLoading, checkingVersion, hasUrl, isAuthenticated, updateInfo, router])

  const isLoading = checkingUrl || isAuthLoading || checkingVersion

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-3xl font-bold mb-3" style={{ color: BRAND_COLOR }}>{APP_NAME}</Text>
        <Text className="text-base text-slate-500 mb-6">Mobile App</Text>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    )
  }

  if (updateInfo) {
    const currentVersion = Constants.expoConfig?.version ?? '1.0.0'
    if (isUpdateRequired(currentVersion, updateInfo.min_version)) {
      return (
        <UpdateRequiredScreen
          downloadUrl={updateInfo.download_url}
          latestVersion={updateInfo.latest_version}
        />
      )
    }
  }

  // Shouldn't reach here normally (router.replace handles it)
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#9B1C1C" />
    </View>
  )
}
