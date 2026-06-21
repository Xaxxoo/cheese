import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import nacl from 'tweetnacl'

const DEVICE_PRIVATE_KEY = 'cheese_device_private_key'
const DEVICE_ID_KEY      = 'cheese_device_id'

// ── Helpers ───────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return result
}

// ── PIN hashing ───────────────────────────────────────────
// SHA-256(pin:userId) — matches the web implementation
export async function hashPin(pin: string, userId: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${pin}:${userId}`,
  )
}

// ── Device ID ─────────────────────────────────────────────
export async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  if (!id) {
    // Use nacl random bytes to build a UUID v4
    const b  = nacl.randomBytes(16)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h  = bytesToHex(b)
    id = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id)
  }
  return id
}

// ── Device key pair (Ed25519) ─────────────────────────────
// privateKey stored = 128-char hex (64-byte Ed25519 secretKey = seed ‖ pubkey).
// Old format (pre-Ed25519) had 64-char privateKey — detected and regenerated on
// first launch after the upgrade.
export async function getOrCreateDeviceKeyPair(): Promise<{
  publicKey: string
  privateKey: string
}> {
  const stored = await SecureStore.getItemAsync(DEVICE_PRIVATE_KEY)
  if (stored) {
    const parsed = JSON.parse(stored) as { publicKey: string; privateKey: string }
    // 128 hex chars = 64-byte Ed25519 secretKey — valid new format
    if (parsed.privateKey.length === 128) return parsed
    // Old SHA-256 placeholder format — fall through to regenerate
  }

  // Generate a real Ed25519 key pair from a random 32-byte seed
  const seed      = nacl.randomBytes(32)
  const keyPair   = nacl.sign.keyPair.fromSeed(seed)
  const publicKey = bytesToHex(keyPair.publicKey)   // 64 hex chars (32 bytes)
  const privateKey = bytesToHex(keyPair.secretKey)  // 128 hex chars (64 bytes)
  const pair = { publicKey, privateKey }
  await SecureStore.setItemAsync(DEVICE_PRIVATE_KEY, JSON.stringify(pair))
  return pair
}

// ── Device signature (Ed25519) ────────────────────────────
// Returns a 128-char hex string (64-byte Ed25519 detached signature).
export async function signDeviceId(
  deviceId: string,
  privateKey: string,
): Promise<string> {
  const secretKey = hexToBytes(privateKey) // 64 bytes
  const message   = new TextEncoder().encode(deviceId)
  const signature = nacl.sign.detached(message, secretKey)
  return bytesToHex(signature)
}
