import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const PIN_HASH_KEY = 'cheese_pin_hash'

// ── PIN hash storage (used for biometric bypass) ──────────
export async function storePinHash(pinHash: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_HASH_KEY, pinHash)
}

export async function getStoredPinHash(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_HASH_KEY)
}

// ── Biometric availability ────────────────────────────────
export async function isBiometricAvailable(): Promise<boolean> {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ])
  return hardware && enrolled
}

// ── Authenticate and return stored pinHash ────────────────
// Returns the stored pinHash on success, null if cancelled / not available.
export async function authenticateWithBiometrics(): Promise<string | null> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to confirm transaction',
    fallbackLabel: 'Use PIN',
    cancelLabel:   'Cancel',
  })
  if (!result.success) return null
  return getStoredPinHash()
}
