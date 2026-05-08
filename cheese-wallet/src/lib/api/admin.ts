// ─────────────────────────────────────────────────────────
// CHEESE PAY — Admin Auth API
// ─────────────────────────────────────────────────────────

import adminApiClient, { adminTokenStore } from './adminClient'

// Inline to avoid circular dependency with adminAuthStore
export type AdminRole = 'super_admin' | 'operator' | 'treasurer' | 'support'

// Inline paths — avoids any module resolution edge cases in production builds
const A = {
  LOGIN:           '/admin/auth/login',
  LOGOUT:          '/admin/auth/logout',
  ME:              '/admin/auth/me',
  ADMINS:          '/admin/auth/admins',
  ADMIN_ROLE:      (id: string) => `/admin/auth/admins/${id}/role`,
  ADMIN_ID:        (id: string) => `/admin/auth/admins/${id}`,
  CHANGE_PASSWORD: '/admin/auth/change-password',
  RATES_CURRENT:   '/admin/rates',
  RATES_SET:       '/admin/rates',
}

export interface AdminUser {
  id:                  string
  email:               string
  name:                string
  adminRole:           AdminRole
  mustChangePassword:  boolean
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
    A.LOGIN,
    { email, password },
  )
  adminTokenStore.set(data.data.accessToken)
  return data.data
}

// ── Me (session restore) ──────────────────────────────────
export async function adminMe(): Promise<AdminUser> {
  const { data } = await adminApiClient.get<ApiResponse<{ admin: AdminUser }>>(
    A.ME,
  )
  return data.data.admin
}

// ── Change password ───────────────────────────────────────
export async function adminChangePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await adminApiClient.patch(A.CHANGE_PASSWORD, { currentPassword, newPassword })
}

// ── Logout ────────────────────────────────────────────────
export async function adminLogout(): Promise<void> {
  await adminApiClient.post(A.LOGOUT)
  adminTokenStore.clear()
}

// ── List admins ───────────────────────────────────────────
export async function listAdmins(): Promise<AdminListItem[]> {
  const { data } = await adminApiClient.get<ApiResponse<{ admins: AdminListItem[] }>>(
    A.ADMINS,
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
    A.ADMINS,
    payload,
  )
  return data.data.admin
}

// ── Update admin role ─────────────────────────────────────
export async function updateAdminRole(id: string, adminRole: AdminRole): Promise<AdminUser> {
  const { data } = await adminApiClient.patch<ApiResponse<{ admin: AdminUser }>>(
    A.ADMIN_ROLE(id),
    { adminRole },
  )
  return data.data.admin
}

// ── Revoke admin ──────────────────────────────────────────
export async function revokeAdmin(id: string): Promise<void> {
  await adminApiClient.delete(A.ADMIN_ID(id))
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
    A.RATES_CURRENT,
  )
  return data.data
}

export async function setAdminRate(
  usdToNgn: number,
  spreadPercent?: number,
): Promise<ExchangeRateRecord> {
  const { data } = await adminApiClient.patch<ApiResponse<ExchangeRateRecord>>(
    A.RATES_SET,
    { usdToNgn, ...(spreadPercent !== undefined && { spreadPercent }) },
  )
  return data.data
}
