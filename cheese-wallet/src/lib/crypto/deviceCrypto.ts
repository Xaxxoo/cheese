// ─────────────────────────────────────────────────────────
// CHEESE PAY — Device Crypto
// Web Crypto API (ECDSA P-256) for device key management.
// Private key is generated on-device, stored in IndexedDB
// as a non-extractable CryptoKey — it NEVER leaves the device.
//
// Flow:
//   1. generateDeviceKeyPair()  → called once on DeviceScreen
//   2. signTransaction(payload) → called before every send/transfer
//   3. hashPin(pin, deviceId)   → called before PIN is sent to API
// ─────────────────────────────────────────────────────────

const DB_NAME    = 'cheese-keys'
const STORE_NAME = 'device-keypair'
const KEY_ID     = 'device-ecdsa-key'

// ── IndexedDB helpers ─────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(new Error('Failed to open key store: ' + req.error?.message))
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(new Error('Failed to store key: ' + req.error?.message))
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(new Error('Failed to read key: ' + req.error?.message))
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(new Error('Failed to delete key: ' + req.error?.message))
  })
}

// ── Bytes → hex string ────────────────────────────────────

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Stored key shape ──────────────────────────────────────

interface StoredKey {
  keyPair:      CryptoKeyPair
  deviceId:     string
  publicKeyHex: string
}

// ── 1. Generate key pair (called once during onboarding) ──

export async function generateDeviceKeyPair(): Promise<{
  deviceId:     string
  publicKeyHex: string
}> {
  // ECDSA P-256 — extractable: false means private key stays in the key store
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,               // private key non-extractable
    ['sign', 'verify'],
  )

  // Export public key in uncompressed point format (65 bytes)
  const publicKeyBytes = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const publicKeyHex   = toHex(publicKeyBytes)

  // Derive a stable deviceId from SHA-256(publicKey)
  const hashBytes = await crypto.subtle.digest('SHA-256', publicKeyBytes)
  const deviceId  = 'CHZ-' + toHex(hashBytes).slice(0, 16).toUpperCase()

  await idbSet(KEY_ID, { keyPair, deviceId, publicKeyHex } satisfies StoredKey)

  return { deviceId, publicKeyHex }
}

// ── 2. Sign a transaction payload ─────────────────────────
//
// Usage: const sig = await signTransaction({ username, amountUsdc, timestamp })
// Pass `sig` as `deviceSignature` in the API call.
// Server verifies with the registered public key.

export async function signTransaction(payload: Record<string, unknown>): Promise<string> {
  const stored = await idbGet<StoredKey>(KEY_ID)
  if (!stored) {
    throw new Error('Device not registered. Please sign out and sign in again.')
  }

  const message  = JSON.stringify({ ...payload, _ts: Date.now() })
  const msgBytes = new TextEncoder().encode(message)

  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    stored.keyPair.privateKey,
    msgBytes,
  )

  return toHex(sigBytes)
}

// ── 3. Hash a PIN before sending to the API ───────────────
//
// We never transmit the raw PIN. We send HMAC-SHA-256(pin, deviceId)
// so the server can verify it matches the stored hash without
// ever knowing the raw PIN.

export async function hashPin(pin: string, deviceId: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    new TextEncoder().encode(pin),
  )
  return toHex(sigBytes)
}

// ── 4. Read device info (no private key — safe to log) ────

export async function getDeviceInfo(): Promise<{
  deviceId:     string
  publicKeyHex: string
} | null> {
  const stored = await idbGet<StoredKey>(KEY_ID)
  if (!stored) return null
  return { deviceId: stored.deviceId, publicKeyHex: stored.publicKeyHex }
}

// ── 5. Check key exists ───────────────────────────────────

export async function hasDeviceKey(): Promise<boolean> {
  const stored = await idbGet(KEY_ID)
  return !!stored
}

// ── 6. Clear key on logout / account deletion ─────────────

export async function clearDeviceKey(): Promise<void> {
  await idbDelete(KEY_ID)
}
