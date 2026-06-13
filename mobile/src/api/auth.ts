import client, { tokenStore } from './client'
import type {
  ApiResponse, User, AuthTokens,
  LoginPayload, SignupPayload,
  OtpVerifyPayload, ResetPasswordPayload,
} from '../types'

export async function login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
  const { data } = await client.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
    '/auth/login', payload,
  )
  const { user, tokens } = data.data
  await tokenStore.setAccess(tokens.accessToken)
  await tokenStore.setRefresh(tokens.refreshToken)
  return { user, tokens }
}

export async function signup(payload: SignupPayload): Promise<{ userId: string; email: string }> {
  const { data } = await client.post<ApiResponse<{ userId: string; email: string }>>(
    '/auth/signup', payload, { timeout: 60_000 },
  )
  return data.data
}

export async function verifyEmailOtp(
  payload: OtpVerifyPayload,
): Promise<{ user: User; tokens: AuthTokens }> {
  const { data } = await client.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
    '/auth/verify-email', payload,
  )
  const { user, tokens } = data.data
  await tokenStore.setAccess(tokens.accessToken)
  await tokenStore.setRefresh(tokens.refreshToken)
  return { user, tokens }
}

export async function resendOtp(email: string, type: OtpVerifyPayload['type']): Promise<void> {
  await client.post('/auth/resend-otp', { email, type })
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<ApiResponse<User>>('/auth/me')
  return data.data
}

export async function forgotPassword(email: string): Promise<void> {
  await client.post('/auth/forgot-password', { email })
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await client.post('/auth/reset-password', payload)
}

export async function setPin(pinHash: string): Promise<void> {
  await client.post('/auth/set-pin', { pinHash })
}

export async function changePin(payload: {
  currentPinHash: string
  newPinHash: string
  deviceId: string
  deviceSignature: string
}): Promise<void> {
  await client.patch('/auth/change-pin', payload)
}

export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout')
  } finally {
    await tokenStore.clear()
  }
}

export async function registerDevice(payload: {
  deviceId: string
  publicKey: string
  deviceName?: string
}): Promise<void> {
  await client.post('/devices/register', payload)
}

export async function updateProfile(payload: {
  fullName?: string
  phone?: string
  username?: string
}): Promise<User> {
  const { data } = await client.patch<ApiResponse<User>>('/auth/profile', payload)
  return data.data
}
