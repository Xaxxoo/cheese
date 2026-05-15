// ─────────────────────────────────────────────────────────
// CHEESE PAY — Auth API Service
// All functions return the unwrapped data payload.
// PIN is never sent in plaintext — always HMAC-SHA256(pin, deviceId).
// ─────────────────────────────────────────────────────────

import apiClient, { tokenStore } from './client'
import { ENDPOINTS }             from '@/constants'
import type {
  ApiResponse,
  AuthTokens,
  DeviceKey,
  LoginPayload,
  OtpVerifyPayload,
  ResetPasswordPayload,
  SignupPayload,
  User,
} from '@/types'

// ── Login ──────────────────────────────────────────────────
export async function login(
  payload: LoginPayload,
): Promise<{ user: User; tokens: AuthTokens }> {
  const { data } = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
    ENDPOINTS.AUTH.LOGIN,
    payload,
  )
  tokenStore.set(data.data.tokens.accessToken)
  return data.data
}

// ── Signup ────────────────────────────────────────────────
export async function signup(
  payload: SignupPayload,
): Promise<{ userId: string; email: string }> {
  const { data } = await apiClient.post<ApiResponse<{ userId: string; email: string }>>(
    ENDPOINTS.AUTH.SIGNUP,
    payload,
  )
  return data.data
}

// ── OTP verify ────────────────────────────────────────────
export async function verifyOtp(
  payload: OtpVerifyPayload,
): Promise<{ verified: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ verified: boolean }>>(
    ENDPOINTS.AUTH.VERIFY_OTP,
    payload,
  )
  return data.data
}

// ── Resend OTP ────────────────────────────────────────────
export async function resendOtp(
  email: string,
  type: OtpVerifyPayload['type'],
): Promise<void> {
  await apiClient.post(ENDPOINTS.AUTH.RESEND_OTP, { email, type })
}

// ── Device registration ───────────────────────────────────
export async function registerDevice(
  payload: Omit<DeviceKey, 'registeredAt'>,
): Promise<DeviceKey> {
  const { data } = await apiClient.post<ApiResponse<DeviceKey>>(
    ENDPOINTS.DEVICE.REGISTER,
    payload,
  )
  return data.data
}

// ── Get current user ──────────────────────────────────────
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>(ENDPOINTS.AUTH.ME)
  return data.data
}

// ── Forgot password ───────────────────────────────────────
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })
}

// ── Reset password ────────────────────────────────────────
export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<void> {
  await apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, payload)
}

// ── Verify PIN ────────────────────────────────────────────
// PIN is hashed client-side: HMAC-SHA256(pin, deviceId).
// Server compares against its stored hash.
// Throws with statusCode 403 if PIN is wrong — callers should catch this.
export async function verifyPin(payload: {
  pinHash:  string   // HMAC-SHA256(pin, deviceId) — base64url
  deviceId: string
}): Promise<{ valid: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ valid: boolean }>>(
    ENDPOINTS.AUTH.VERIFY_PIN,
    payload,
  )
  if (!data.data.valid) {
    const err = new Error('Incorrect PIN') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
  return data.data
}

// ── Change PIN ────────────────────────────────────────────
export async function changePin(payload: {
  currentPinHash:  string
  newPinHash:      string
  deviceId:        string
  deviceSignature: string
}): Promise<void> {
  await apiClient.post(ENDPOINTS.AUTH.CHANGE_PIN, payload)
}

// ── Logout ────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await apiClient.post(ENDPOINTS.AUTH.LOGOUT)
  tokenStore.clear()
}

// ── Device registration (unauthenticated) ─────────────────
export async function requestDeviceRegistration(email: string): Promise<void> {
  await apiClient.post('/auth/device-registration/request', { email })
}

export async function completeDeviceRegistration(payload: {
  email:     string
  otp:       string
  deviceId:  string
  publicKey: string
}): Promise<void> {
  await apiClient.post('/auth/device-registration/complete', payload)
}
