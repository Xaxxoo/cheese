// ─────────────────────────────────────────────────────────
// CHEESE PAY — Admin Auth API
// ─────────────────────────────────────────────────────────

import adminApiClient, { adminTokenStore } from './adminClient'
import { ENDPOINTS } from '@/constants'
import type { AdminRole } from '@/store/adminAuthStore'

export interface AdminUser {
  id:        string
  email:     string
  name:      string
  adminRole: AdminRole
}

export interface AdminListItem extends AdminUser {
  createdAt: string
}

interface ApiResponse<T> { data: T }

// ── Login ──────────────────────────────────────────────────
export async function adminLogin(
  email: string,
  password: string,
): Promise<{ admin: AdminUser; accessToken: string }> {
  const { data } = await adminApiClient.post<ApiResponse<{ admin: AdminUser; accessToken: string }>>(
    ENDPOINTS.ADMIN_AUTH.LOGIN,
    { email, password },
  )
  adminTokenStore.set(data.data.accessToken)
  return data.data
}

// ── Me (session restore) ──────────────────────────────────
export async function adminMe(): Promise<AdminUser> {
  const { data } = await adminApiClient.get<ApiResponse<{ admin: AdminUser }>>(
    ENDPOINTS.ADMIN_AUTH.ME,
  )
  return data.data.admin
}

// ── Change password ───────────────────────────────────────
export async function adminChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await adminApiClient.patch(ENDPOINTS.ADMIN_AUTH.CHANGE_PASSWORD, { currentPassword, newPassword })
}

// ── Logout ────────────────────────────────────────────────
export async function adminLogout(): Promise<void> {
  await adminApiClient.post(ENDPOINTS.ADMIN_AUTH.LOGOUT)
  adminTokenStore.clear()
}

// ── List admins ───────────────────────────────────────────
export async function listAdmins(): Promise<AdminListItem[]> {
  const { data } = await adminApiClient.get<ApiResponse<{ admins: AdminListItem[] }>>(
    ENDPOINTS.ADMIN_AUTH.ADMINS,
  )
  return data.data.admins
}

// ── Create admin ──────────────────────────────────────────
export async function createAdmin(payload: {
  email:     string
  fullName:  string
  password:  string
  adminRole: AdminRole
}): Promise<AdminUser> {
  const { data } = await adminApiClient.post<ApiResponse<{ admin: AdminUser }>>(
    ENDPOINTS.ADMIN_AUTH.ADMINS,
    payload,
  )
  return data.data.admin
}

// ── Update admin role ─────────────────────────────────────
export async function updateAdminRole(id: string, adminRole: AdminRole): Promise<AdminUser> {
  const { data } = await adminApiClient.patch<ApiResponse<{ admin: AdminUser }>>(
    ENDPOINTS.ADMIN_AUTH.ADMIN_ROLE(id),
    { adminRole },
  )
  return data.data.admin
}

// ── Revoke admin ──────────────────────────────────────────
export async function revokeAdmin(id: string): Promise<void> {
  await adminApiClient.delete(ENDPOINTS.ADMIN_AUTH.ADMIN_ID(id))
}

// ── Exchange rate ─────────────────────────────────────────
export interface ExchangeRateRecord {
  id:            string
  usdToNgn:      string
  effectiveRate: string
  spreadPercent: string
  source:        string
  fetchedAt:     string
}

export async function getAdminRate(): Promise<ExchangeRateRecord> {
  const { data } = await adminApiClient.get<ApiResponse<ExchangeRateRecord>>(
    ENDPOINTS.ADMIN_RATES.CURRENT,
  )
  return data.data
}

export async function setAdminRate(
  usdToNgn: number,
  spreadPercent?: number,
): Promise<ExchangeRateRecord> {
  const { data } = await adminApiClient.patch<ApiResponse<ExchangeRateRecord>>(
    ENDPOINTS.ADMIN_RATES.SET,
    { usdToNgn, ...(spreadPercent !== undefined && { spreadPercent }) },
  )
  return data.data
}
