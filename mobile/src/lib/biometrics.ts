import * as LocalAuthentication from 'expo-local-authentication'

export async function isBiometricsAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync()
  if (!compatible) return false

  const enrolled = await LocalAuthentication.isEnrolledAsync()
  return enrolled
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in to 027Apps',
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  })

  return result.success
}
