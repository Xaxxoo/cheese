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
  // If the token is already gone (cleared by the 401 interceptor before
  // firing admin:auth:expired), skip the API call entirely.  Without this
  // guard the interceptor would retry the unauthenticated logout → 401 →
  // refresh attempt → refresh failure → another admin:auth:expired → loop.
  if (!adminTokenStore.get()) return
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

// ── Dashboard stats ───────────────────────────────────────────────────────
export interface AdminStats {
  totalUsers:               number
  verifiedUsers:            number
  premiumUsers:             number
  pendingKyc:               number
  pendingBlackCount:        number
  totalTransactions:        number
  activeWallets:            number
  pendingWallets:           number
  failedWallets:            number
  activeEvmWallets:         number
  pendingEvmWallets:        number
  failedEvmWallets:         number
  failedBankTransfersToday: number
  flaggedUsers:             number
  totalVolumeUsdc:          number
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await adminApiClient.get<ApiResponse<AdminStats>>('/admin/stats')
  return data.data
}

// ── User listing ──────────────────────────────────────────────────────────
export interface AdminUserItem {
  id:           string
  name:         string
  username:     string
  email:        string
  tier:         string
  kycStatus:    string
  walletStatus: string
  isFlagged:    boolean
  createdAt:    string
}

export async function listAdminUsers(params?: {
  page?:    number
  limit?:   number
  search?:  string
  tier?:    string
  kyc?:     string
  wallet?:  string
  flagged?: boolean
}): Promise<{ users: AdminUserItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    users: AdminUserItem[]
    total: number
    page:  number
    limit: number
  }>>('/admin/users', { params })
  return data.data
}

// ── KYC listing ───────────────────────────────────────────────────────────
export interface AdminKycUserItem {
  id:                   string
  name:                 string
  username:             string
  email:                string
  tier:                 string
  kycStatus:            string
  pendingBlackApproval: boolean
  updatedAt:            string
  createdAt:            string
}

export async function listAdminKyc(params?: {
  page?:         number
  limit?:        number
  search?:       string
  tier?:         string
  kyc?:          string
  pendingBlack?: boolean
}): Promise<{ users: AdminKycUserItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    users: AdminKycUserItem[]
    total: number
    page:  number
    limit: number
  }>>('/admin/kyc', { params })
  return data.data
}

export async function approveBlackTier(userId: string): Promise<{ id: string; tier: string }> {
  const { data } = await adminApiClient.post<ApiResponse<{ id: string; tier: string }>>(
    `/admin/kyc/${userId}/approve`,
  )
  return data.data
}

export async function rejectBlackTier(
  userId: string,
  reason: string,
): Promise<{ id: string; rejected: boolean }> {
  const { data } = await adminApiClient.post<ApiResponse<{ id: string; rejected: boolean }>>(
    `/admin/kyc/${userId}/reject`,
    { reason },
  )
  return data.data
}

// ── Transfers listing ─────────────────────────────────────────────────────
export interface AdminTransferItem {
  id:            string
  reference:     string
  username:      string
  userId:        string
  bankName:      string
  accountName:   string
  accountNumber: string
  amountNgn:     string
  amountUsdc:    string
  status:        string
  failureReason: string | null
  createdAt:     string
}

export async function listAdminTransfers(params?: {
  page?:   number
  limit?:  number
  status?: string
  search?: string
  userId?: string
}): Promise<{ transfers: AdminTransferItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    transfers: AdminTransferItem[]
    total: number
    page:  number
    limit: number
  }>>('/admin/transfers', { params })
  return data.data
}

// ── User detail ───────────────────────────────────────────────────────────
export interface AdminUserDetail {
  id:               string
  name:             string
  username:         string
  email:            string
  phone:            string | null
  tier:             string
  kycStatus:        string
  walletStatus:     string
  evmWalletStatus:  string
  stellarPublicKey: string | null
  evmAddress:       string | null
  isActive:         boolean
  isFlagged:        boolean
  emailVerified:    boolean
  referralCode:     string | null
  points:           number
  createdAt:        string
  usdcBalance:      string | null
  txCount:          number
  failedTransferCount: number
  recentTransactions: Array<{
    id: string; type: string; status: string; amountUsdc: string | null; createdAt: string
  }>
  recentTransfers: Array<{
    id: string; bankName: string; accountName: string; amountNgn: string;
    status: string; failureReason: string | null; createdAt: string
  }>
}

export async function getAdminUserDetail(id: string): Promise<AdminUserDetail> {
  const { data } = await adminApiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`)
  return data.data
}

export async function flagAdminUser(id: string, flag: boolean): Promise<{ id: string; isFlagged: boolean }> {
  const { data } = await adminApiClient.patch<ApiResponse<{ id: string; isFlagged: boolean }>>(
    `/admin/users/${id}/flag`, { flag },
  )
  return data.data
}

export async function completeAdminTransfer(id: string): Promise<{ id: string; status: string }> {
  const { data } = await adminApiClient.patch<ApiResponse<{ id: string; status: string }>>(
    `/admin/transfers/${id}/complete`,
  )
  return data.data
}

export async function setAdminUserStatus(id: string, isActive: boolean): Promise<{ id: string; isActive: boolean }> {
  const { data } = await adminApiClient.patch<ApiResponse<{ id: string; isActive: boolean }>>(
    `/admin/users/${id}/status`, { isActive },
  )
  return data.data
}

export async function setAdminUserKycVerified(id: string): Promise<{ id: string; kycStatus: string }> {
  const { data } = await adminApiClient.patch<ApiResponse<{ id: string; kycStatus: string }>>(
    `/admin/users/${id}/kyc`,
  )
  return data.data
}

export async function deleteAdminUser(id: string): Promise<void> {
  await adminApiClient.delete(`/admin/users/${id}`)
}

// ── Treasury ──────────────────────────────────────────────────────────────
export interface EvmVaultBalance {
  vaultAddress: string
  payments:     string
  fees:         string
  total:        string
  chainId:      number
}

export interface TreasuryBalance {
  address:     string
  balanceUsdc: string
  evmVault?:   EvmVaultBalance   // absent if Amoy not configured
}

export async function getTreasuryBalance(): Promise<TreasuryBalance> {
  const { data } = await adminApiClient.get<ApiResponse<TreasuryBalance>>('/admin/treasury')
  return data.data
}

export async function treasuryTransfer(
  toAddress: string,
  amountUsdc: string,
): Promise<{ txHash: string; toAddress: string; amountUsdc: string }> {
  const { data } = await adminApiClient.post<ApiResponse<{ txHash: string; toAddress: string; amountUsdc: string }>>(
    '/admin/treasury/transfer',
    { toAddress, amountUsdc },
  )
  return data.data
}

export async function evmTreasuryWithdraw(): Promise<{ txHash: string; toAddress: string }> {
  const { data } = await adminApiClient.post<
    ApiResponse<{ txHash: string; toAddress: string }>
  >('/admin/treasury/evm-withdraw')
  return data.data
}

// ── Transactions ──────────────────────────────────────────────────────────
export interface AdminTransactionItem {
  id:                string
  reference:         string
  userId:            string
  username:          string
  type:              string
  status:            string
  amountUsdc:        string
  amountNgn:         string | null
  feeUsdc:           string
  recipientUsername: string | null
  recipientAddress:  string | null
  bankName:          string | null
  txHash:            string | null
  failureReason:     string | null
  createdAt:         string
}

export async function listAdminTransactions(params?: {
  page?:   number
  limit?:  number
  status?: string
  type?:   string
  search?: string
  userId?: string
}): Promise<{ transactions: AdminTransactionItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    transactions: AdminTransactionItem[]
    total:        number
    page:         number
    limit:        number
  }>>('/admin/transactions', { params })
  return data.data
}

// ── Fee revenue ───────────────────────────────────────────────────────────
export interface AdminFeeTransferItem {
  id:            string
  reference:     string
  userId:        string
  username:      string
  accountName:   string
  bankName:      string
  accountNumber: string
  amountNgn:     string
  amountUsdc:    string
  feeUsdc:       string
  rateApplied:   string
  status:        string
  createdAt:     string
}

export interface AdminFeeSummary {
  totalFeesUsdc:       number
  totalCompletedCount: number
  todayFeesUsdc:       number
  monthFeesUsdc:       number
}

export async function getAdminFeeStats(params?: {
  page?:   number
  limit?:  number
  search?: string
}): Promise<{
  summary:   AdminFeeSummary
  transfers: AdminFeeTransferItem[]
  total:     number
  page:      number
  limit:     number
}> {
  const { data } = await adminApiClient.get<ApiResponse<{
    summary:   AdminFeeSummary
    transfers: AdminFeeTransferItem[]
    total:     number
    page:      number
    limit:     number
  }>>('/admin/fees', { params })
  return data.data
}

// ── Pay links ─────────────────────────────────────────────────────────────
export interface AdminPayLinkItem {
  id:              string
  token:           string
  creatorId:       string
  creatorUsername: string
  payerId:         string | null
  payerUsername:   string | null
  amountUsdc:      string
  note:            string | null
  status:          string
  expiresAt:       string
  paidAt:          string | null
  settledTxHash:   string | null
  createdAt:       string
}

export async function listAdminPaylinks(params?: {
  page?:   number
  limit?:  number
  status?: string
  search?: string
}): Promise<{ paylinks: AdminPayLinkItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    paylinks: AdminPayLinkItem[]
    total:    number
    page:     number
    limit:    number
  }>>('/admin/paylinks', { params })
  return data.data
}

// ── Waitlist ──────────────────────────────────────────────────────────────
export interface AdminWaitlistItem {
  id:           string
  email:        string
  username:     string
  status:       string
  position:     number | null
  points:       number
  referralCode: string | null
  referrerId:   string | null
  notifiedAt:   string | null
  convertedAt:  string | null
  createdAt:    string
}

export async function listAdminWaitlist(params?: {
  page?:   number
  limit?:  number
  status?: string
  search?: string
}): Promise<{ entries: AdminWaitlistItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    entries: AdminWaitlistItem[]
    total:   number
    page:    number
    limit:   number
  }>>('/admin/waitlist', { params })
  return data.data
}

// ── Virtual cards ─────────────────────────────────────────────────────────
export interface AdminCardItem {
  id:               string
  userId:           string
  username:         string
  email:            string
  last4:            string
  network:          string
  holderName:       string
  status:           string
  availableBalance: string
  spendLimit:       string
  monthlySpend:     string
  expiryMonth:      string
  expiryYear:       string
  createdAt:        string
}

export async function listAdminCards(params?: {
  page?:   number
  limit?:  number
  status?: string
  search?: string
}): Promise<{ cards: AdminCardItem[]; total: number; page: number; limit: number }> {
  const { data } = await adminApiClient.get<ApiResponse<{
    cards: AdminCardItem[]
    total: number
    page:  number
    limit: number
  }>>('/admin/cards', { params })
  return data.data
}

// ── Health check ──────────────────────────────────────────────────────────
export interface AdminHealth {
  stellar:  boolean
  evm:      boolean
  pulsemfb: boolean
  database: boolean
  redis:    boolean
}

export async function getAdminHealth(): Promise<AdminHealth> {
  const { data } = await adminApiClient.get<ApiResponse<AdminHealth>>('/admin/health')
  return data.data
}
