// ─────────────────────────────────────────────────────────
// CHEESE PAY — Device Signing (Web Crypto API)
//
// Uses ECDSA P-256 via the browser's SubtleCrypto API.
// The private key is generated once, stored in IndexedDB
// as non-extractable, and NEVER leaves the device.
// The public key is exported as base64url SPKI for registration.
//
// Security model:
//   - Private key: non-extractable CryptoKey in IndexedDB
//   - Public key:  base64url SPKI, stored in authStore + server
//   - Signature:   ECDSA over SHA-256 of canonical payload JSON
//   - Payload signed: { userId, amount, recipient, timestamp, nonce }
// ─────────────────────────────────────────────────────────

const DB_NAME    = 'cheese-device-keys'
const DB_VERSION = 1
const STORE_NAME = 'keys'
const ALGO       = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_ALGO  = { name: 'ECDSA', hash: { name: 'SHA-256' } } as const

// ── IndexedDB helpers ─────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror   = () => reject(req.error)
  })
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Encoding helpers ──────────────────────────────────────

function bufToBase64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function strToUtf8Buf(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer as ArrayBuffer
}

// ── Public API ────────────────────────────────────────────

/**
 * Generates a new ECDSA P-256 key pair.
 * Stores private key in IndexedDB under `deviceId`.
 * Returns the public key as base64url SPKI + the deviceId.
 */
export async function generateDeviceKey(deviceId: string): Promise<{
  deviceId:  string
  publicKey: string   // base64url SPKI
}> {
  const pair = await crypto.subtle.generateKey(ALGO, false, ['sign', 'verify'])

  // Export public key as SPKI
  const spkiBuf  = await crypto.subtle.exportKey('spki', pair.publicKey)
  const publicKey = bufToBase64url(spkiBuf)

  // Store the full key pair (private key is non-extractable)
  const db = await openDb()
  await idbSet(db, deviceId, pair)

  return { deviceId, publicKey }
}

/**
 * Signs a canonical transaction payload.
 * Payload is serialised deterministically (sorted keys).
 * Returns base64url DER signature.
 *
 * @param deviceId  - The device ID registered with the server
 * @param payload   - Arbitrary object; will be JSON-serialised deterministically
 */
export async function signPayload(
  deviceId: string,
  payload:  Record<string, unknown>,
): Promise<string> {
  const db   = await openDb()
  const pair = await idbGet<CryptoKeyPair>(db, deviceId)

  if (!pair?.privateKey) {
    throw new Error(
      'Device key not found. Re-register this device to continue.',
    )
  }

  // Canonical serialisation: sorted keys, no whitespace
  const canonical = JSON.stringify(
    Object.keys(payload).sort().reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = payload[k]; return acc
    }, {}),
  )

  const sigBuf = await crypto.subtle.sign(
    SIGN_ALGO,
    pair.privateKey,
    strToUtf8Buf(canonical),
  )

  return bufToBase64url(sigBuf)
}

/**
 * Signs just the raw deviceId string for the login challenge.
 * The backend verifies: verifyDeviceSignature({ message: deviceId, ... })
 * so the signed bytes must be exactly UTF-8(deviceId), NOT JSON.
 */
export async function signDeviceChallenge(deviceId: string): Promise<string> {
  const db   = await openDb()
  const pair = await idbGet<CryptoKeyPair>(db, deviceId)

  if (!pair?.privateKey) {
    throw new Error(
      'Device key not found. Re-register this device to continue.',
    )
  }

  const sigBuf = await crypto.subtle.sign(
    SIGN_ALGO,
    pair.privateKey,
    strToUtf8Buf(deviceId),
  )

  return bufToBase64url(sigBuf)
}

/**
 * Checks whether a key pair exists locally for the given deviceId.
 * Used at login to decide if re-registration is required.
 */
export async function hasDeviceKey(deviceId: string): Promise<boolean> {
  try {
    const db  = await openDb()
    const key = await idbGet<CryptoKeyPair>(db, deviceId)
    return !!key?.privateKey
  } catch {
    return false
  }
}

/**
 * Builds the standard transaction signing payload.
 * The server verifies this exact structure.
 */
export function buildTxPayload(opts: {
  userId:    string
  action:    'send_username' | 'send_address' | 'bank_transfer' | 'reveal_cvv' | 'change_pin'
  amount:    string
  recipient: string
  timestamp: number
  nonce:     string
}): Record<string, unknown> {
  return {
    action:    opts.action,
    amount:    opts.amount,
    nonce:     opts.nonce,
    recipient: opts.recipient,
    timestamp: opts.timestamp,
    userId:    opts.userId,
  }
}

/**
 * Convenience: generate nonce + timestamp + sign in one call.
 * Returns { deviceSignature, deviceId, timestamp, nonce }
 */
export async function signTransaction(opts: {
  deviceId:  string
  userId:    string
  action:    'send_username' | 'send_address' | 'bank_transfer' | 'reveal_cvv' | 'change_pin'
  amount:    string
  recipient: string
}): Promise<{
  deviceSignature: string
  deviceId:        string
  timestamp:       number
  nonce:           string
}> {
  const timestamp = Date.now()
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce      = bufToBase64url(nonceBytes.buffer as ArrayBuffer)

  const payload = buildTxPayload({
    userId:    opts.userId,
    action:    opts.action,
    amount:    opts.amount,
    recipient: opts.recipient,
    timestamp,
    nonce,
  })

  const deviceSignature = await signPayload(opts.deviceId, payload)

  return { deviceSignature, deviceId: opts.deviceId, timestamp, nonce }
}

/**
 * Hashes a PIN for server verification.
 * Uses HMAC-SHA256(pin, deviceId) so the same PIN produces
 * different hashes on different devices.
 * Returns base64url string.
 */
export async function hashPin(pin: string, deviceId: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    new TextEncoder().encode(pin),
  )
  return bufToBase64url(sigBuf)
}
