import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { setServerUrl } from '@/lib/server-url'

type Step = 'scan' | 'code' | 'logging'

export default function PairQRScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [step, setStep] = useState<Step>('scan')
  const [sessionId, setSessionId] = useState('')
  const [serverUrlVal, setServerUrlVal] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [scanned, setScanned] = useState(false)

  const handleScan = (data: string) => {
    if (scanned) return
    try {
      const parsed = JSON.parse(data)
      if (parsed.v !== 1 || !parsed.s || !parsed.u) {
        setError('Invalid QR code')
        return
      }
      setScanned(true)
      setSessionId(parsed.s)
      setServerUrlVal(parsed.u)
      setStep('code')
      setError('')
    } catch {
      setError('Invalid QR code format')
    }
  }

  const handleVerify = async () => {
    if (!code.trim() || code.length !== 6) {
      setError('Enter the 6-digit code shown on screen')
      return
    }
    setError('')
    setStep('logging')

    try {
      const res = await fetch(`${serverUrlVal}/api/v1/auth/pair/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, code: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.email) {
        setError(data.message || 'Verification failed. Wrong code?')
        setStep('code')
        setScanned(false)
        return
      }

      // Save server URL and redirect to login with paired info
      await setServerUrl(serverUrlVal)
      router.replace({ pathname: '/login', params: { paired: 'true', email: data.email } })
    } catch {
      setError('Connection error. Make sure the server URL is correct.')
      setStep('code')
      setScanned(false)
    }
  }

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <ActivityIndicator size="large" color="#9B1C1C" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold text-slate-900 mb-2">Camera permission required</Text>
        <Text className="text-sm text-slate-500 text-center mb-4">
          Allow camera access to scan the QR code from the web app
        </Text>
        <TouchableOpacity
          className="bg-[#9B1C1C] rounded-lg px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant permission</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-white">
      {step === 'scan' && (
        <View className="flex-1">
          <CameraView
            className="flex-1"
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(result) => {
              if (result?.data && !scanned) handleScan(result.data)
            }}
          />
          <View className="absolute inset-0 justify-center items-center">
            <View className="w-64 h-64 border-2 border-white/60 rounded-xl" />
          </View>
          <View className="absolute bottom-20 left-0 right-0 items-center">
            {error && (
              <View className="bg-red-50 rounded-lg px-4 py-2 mb-3 mx-6">
                <Text className="text-red-700 text-sm text-center">{error}</Text>
              </View>
            )}
            <Text className="text-white text-sm font-medium bg-black/40 px-4 py-2 rounded-full">
              Scan QR code from the web app
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 bg-white/20 rounded-lg px-6 py-2"
            >
              <Text className="text-white text-sm font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'code' && (
        <View className="flex-1 justify-center px-6">
          <Text className="text-2xl font-bold text-[#9B1C1C] text-center mb-2">Enter code</Text>
          <Text className="text-sm text-slate-500 text-center mb-8">
            Enter the 6-digit code shown on the web app
          </Text>

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm text-center">{error}</Text>
            </View>
          )}

          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-4 text-2xl text-center font-mono tracking-[0.5em] bg-white"
            placeholder="000000"
            placeholderTextColor="#CBD5E1"
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <TouchableOpacity
            className="bg-[#9B1C1C] rounded-lg py-3 items-center mt-6"
            onPress={handleVerify}
            disabled={code.length !== 6}
            activeOpacity={0.8}
          >
            <Text className="text-white text-base font-semibold">Verify & Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setStep('scan'); setScanned(false); setError('') }}
            className="py-3 items-center mt-2"
          >
            <Text className="text-[#9B1C1C] text-sm font-medium">Scan again</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'logging' && (
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#9B1C1C" />
          <Text className="text-sm text-slate-500 mt-4">Verifying...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}
