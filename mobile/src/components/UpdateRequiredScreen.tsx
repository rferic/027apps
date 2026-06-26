import { View, Text, TouchableOpacity, Linking } from 'react-native'

interface Props {
  downloadUrl: string
  latestVersion: string
}

export function UpdateRequiredScreen({ downloadUrl, latestVersion }: Props) {
  async function handleDownload() {
    try {
      await Linking.openURL(downloadUrl)
    } catch {
      // Can't open URL
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-[#9B1C1C] mb-2">027Apps</Text>
      <Text className="text-base text-slate-500 mb-10 text-center">
        Update Required
      </Text>

      <View className="bg-rose-50 border border-rose-200 rounded-xl p-6 w-full max-w-sm mb-8">
        <Text className="text-base text-slate-800 text-center mb-2 font-semibold">
          A new version of 027Apps is available
        </Text>
        <Text className="text-sm text-slate-600 text-center mb-4">
          You must update to version {latestVersion} to continue using the app.
        </Text>
        <Text className="text-xs text-slate-400 text-center">
          Your current version is no longer supported.
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleDownload}
        className="bg-[#9B1C1C] rounded-xl px-8 py-4 mb-4 w-full max-w-sm items-center"
      >
        <Text className="text-white font-semibold text-base">Download Update</Text>
      </TouchableOpacity>

      <Text className="text-xs text-slate-400 text-center">
        You will be redirected to download the latest APK.
      </Text>
    </View>
  )
}
