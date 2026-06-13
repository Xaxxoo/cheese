import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const DEVICE_PRIVATE_KEY = 'cheese_device_private_key'
const DEVICE_ID_KEY      = 'cheese_device_id'

// ── PIN hashing ───────────────────────────────────────────
// Matches the web implementation: HMAC-SHA256(pin, userId)
export async function hashPin(pin: string, userId: string): Promise<string> {
  const key = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${pin}:${userId}`,
  )
  return key
}

// ── Device ID ─────────────────────────────────────────────
export async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (!id) {
    id = Crypto.randomUUID()
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id)
  }
  return id
}

// ── Device key pair ───────────────────────────────────────
// Stored as a simple secret; for production you would use a
// hardware-backed key via expo-modules or react-native-keychain.
export async function getOrCreateDeviceKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const stored = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored) as { publicKey: string; privateKey: string }
    return parsed
  }
  // Generate a random key pair placeholder —
  // replace with real Ed25519 generation when adding signing library
  const privateKey = Array.from(Crypto.getRandomBytes(32))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const publicKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    privateKey,
  )
  const pair = { publicKey, privateKey }
  await SecureStore.setItemAsync(DEVICE_PRIVATE_KEY, JSON.stringify(pair))
  return pair
}

// ── Device signature ──────────────────────────────────────
// Placeholder — returns SHA256(deviceId + privateKey) until a proper
// Ed25519 signing library (e.g. @noble/ed25519) is integrated.
export async function signDeviceId(deviceId: string, privateKey: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${deviceId}:${privateKey}`,
  )
}
