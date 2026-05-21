// ─────────────────────────────────────────────────────────
// CHEESE PAY — Wallet, Transactions, Banks, Rates, Card
// ─────────────────────────────────────────────────────────

import apiClient from './client'
import { ENDPOINTS } from '@/constants'
import type {
  AccountResolvePayload,
  AccountResolveResponse,
  ApiResponse,
  BankTransferPayload,
  BankTransferResponse,
  DepositNetwork,
  ExchangeRate,
  NigerianBank,
  Transaction,
  TransactionListResponse,
  VirtualCard,
  WalletAddress,
  WalletBalance,
} from '@/types'

// ── Wallet ────────────────────────────────────────────────
export async function getBalance(): Promise<WalletBalance> {
  const { data } = await apiClient.get<ApiResponse<WalletBalance>>(ENDPOINTS.WALLET.BALANCE)
  return data.data
}

export async function getWalletAddress(): Promise<WalletAddress> {
  const { data } = await apiClient.get<ApiResponse<WalletAddress>>(ENDPOINTS.WALLET.ADDRESS)
  return data.data
}

export async function getDepositNetworks(): Promise<DepositNetwork[]> {
  const { data } = await apiClient.get<ApiResponse<DepositNetwork[]>>(
    ENDPOINTS.WALLET.DEPOSIT_NETWORKS,
  )
  return data.data
}

// ── Transactions ──────────────────────────────────────────
export async function getTransactions(page = 1, pageSize = 20): Promise<TransactionListResponse> {
  const { data } = await apiClient.get<ApiResponse<TransactionListResponse>>(
    ENDPOINTS.TRANSACTIONS.LIST,
    { params: { page, pageSize } },
  )
  return data.data
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data } = await apiClient.get<ApiResponse<Transaction>>(
    ENDPOINTS.TRANSACTIONS.BY_ID(id),
  )
  return data.data
}

// ── Send USDC ─────────────────────────────────────────────
export async function resolveUsername(username: string): Promise<{ address: string; username: string }> {
  const { data } = await apiClient.get<ApiResponse<{ address: string; username: string }>>(
    ENDPOINTS.SEND.RESOLVE_USERNAME(username),
  )
  return data.data
}

export async function sendToUsername(payload: {
  username: string
  amountUsdc: string
  pin: string
  deviceSignature: string
  deviceId: string
}): Promise<Transaction> {
  const { data } = await apiClient.post<ApiResponse<Transaction>>(
    ENDPOINTS.SEND.TO_USERNAME,
    payload,
  )
  return data.data
}

export async function getSendFeeRate(): Promise<{ feeRate: number; feePct: string }> {
  const { data } = await apiClient.get<ApiResponse<{ feeRate: number; feePct: string }>>(
    ENDPOINTS.SEND.FEE_RATE,
  )
  return data.data
}

export async function sendToAddress(payload: {
  address: string
  amountUsdc: string
  network: string
  pin: string
  deviceSignature: string
  deviceId: string
}): Promise<Transaction> {
  const { data } = await apiClient.post<ApiResponse<Transaction>>(
    ENDPOINTS.SEND.TO_ADDRESS,
    payload,
  )
  return data.data
}

// ── Banks ─────────────────────────────────────────────────
export async function getBanks(): Promise<NigerianBank[]> {
  const { data } = await apiClient.get<ApiResponse<NigerianBank[]>>(ENDPOINTS.BANK.LIST)
  return data.data
}

export async function resolveAccount(
  payload: AccountResolvePayload,
): Promise<AccountResolveResponse> {
  const { data } = await apiClient.post<ApiResponse<AccountResolveResponse>>(
    ENDPOINTS.BANK.RESOLVE_ACCOUNT,
    payload,
  )
  return data.data
}

export async function bankTransfer(payload: BankTransferPayload): Promise<BankTransferResponse> {
  const { data } = await apiClient.post<ApiResponse<BankTransferResponse>>(
    ENDPOINTS.BANK.TRANSFER,
    payload,
    { timeout: 60_000 },
  )
  return data.data
}

// ── Exchange Rate ─────────────────────────────────────────
export async function getExchangeRate(): Promise<ExchangeRate> {
  const { data } = await apiClient.get<ApiResponse<ExchangeRate>>(ENDPOINTS.RATES.CURRENT)
  return data.data
}

// ── Virtual Card ──────────────────────────────────────────
export async function getCard(): Promise<VirtualCard> {
  const { data } = await apiClient.get<ApiResponse<VirtualCard>>(ENDPOINTS.CARD.DETAILS)
  return data.data
}

export async function freezeCard(): Promise<VirtualCard> {
  const { data } = await apiClient.post<ApiResponse<VirtualCard>>(ENDPOINTS.CARD.FREEZE)
  return data.data
}

export async function unfreezeCard(): Promise<VirtualCard> {
  const { data } = await apiClient.post<ApiResponse<VirtualCard>>(ENDPOINTS.CARD.UNFREEZE)
  return data.data
}

export async function revealCvv(pin: string): Promise<{ cvv: string; expiresAt: string }> {
  const { data } = await apiClient.post<ApiResponse<{ cvv: string; expiresAt: string }>>(
    ENDPOINTS.CARD.CVV,
    { pin },
  )
  return data.data
}

// ── Profile update ────────────────────────────────────────
export async function updateProfile(payload: {
  fullName?: string
  username?: string
  phone?: string
}): Promise<import('@/types').User> {
  const { data } = await apiClient.patch<import('@/types').ApiResponse<import('@/types').User>>(
    ENDPOINTS.PROFILE.UPDATE,
    payload,
  )
  return data.data
}

// ── Device management ─────────────────────────────────────
export interface DeviceSummary {
  id:        string
  deviceName: string
  lastSeen:  string
  location?: string
  isCurrent: boolean
}

export async function listDevices(): Promise<DeviceSummary[]> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<DeviceSummary[]>>(
    ENDPOINTS.DEVICE.LIST,
  )
  return data.data
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await apiClient.delete(ENDPOINTS.DEVICE.REVOKE(deviceId))
}

export async function syncBankTransferStatus(
  reference: string,
): Promise<{ reference: string; status: string; synced: boolean }> {
  const { data } = await apiClient.get<
    import('@/types').ApiResponse<{ reference: string; status: string; synced: boolean }>
  >(ENDPOINTS.BANK.TRANSFER_STATUS(reference))
  return data.data
}

// ── Notifications ─────────────────────────────────────────
export interface Notification {
  id:        string
  type:      'money' | 'security' | 'system'
  title:     string
  body:      string
  read:      boolean
  createdAt: string
  deepLink?: string
}

export async function getNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<Notification[]>>(
    ENDPOINTS.NOTIFICATIONS.LIST,
  )
  return data.data
}

export async function markNotificationsRead(): Promise<void> {
  await apiClient.post(ENDPOINTS.NOTIFICATIONS.MARK_READ)
}

export async function subscribePush(sub: {
  endpoint: string
  p256dh: string
  authKey: string
}): Promise<void> {
  await apiClient.post(ENDPOINTS.NOTIFICATIONS.SUBSCRIBE, sub)
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await apiClient.delete(ENDPOINTS.NOTIFICATIONS.SUBSCRIBE, { data: { endpoint } })
}

// ── Earn / Yield ──────────────────────────────────────────
export interface EarnBalance {
  balance:      number
  earnedMonth:  number
  earnedTotal:  number
  apy:          number
  protocol:     string
  compounding:  string
}

export async function getEarnBalance(): Promise<EarnBalance> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<EarnBalance>>(
    ENDPOINTS.EARN.BALANCE,
  )
  return data.data
}

// ── Referral ──────────────────────────────────────────────
export interface ReferralInfo {
  code:          string
  link:          string
  totalReferrals: number
  pendingReward:  number
  paidReward:     number
}

export async function getReferralInfo(): Promise<ReferralInfo> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<ReferralInfo>>(
    ENDPOINTS.REFERRAL.INFO,
  )
  return data.data
}

// ── PayLink ───────────────────────────────────────────────
import type {
  CreatePayLinkPayload, CreatePayLinkResponse,
  PayLinkData, PayLinkPayPayload, PayLinkPayResponse, MyLinksResponse,
} from '@/types'

export async function createPayLink(payload: CreatePayLinkPayload): Promise<CreatePayLinkResponse> {
  const { data } = await apiClient.post<import('@/types').ApiResponse<CreatePayLinkResponse>>(
    ENDPOINTS.PAYLINK.CREATE,
    payload,
  )
  return data.data
}

export async function resolvePayLink(token: string): Promise<PayLinkData> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<PayLinkData>>(
    ENDPOINTS.PAYLINK.RESOLVE(token),
  )
  return data.data
}

export async function payPayLink(token: string, payload: PayLinkPayPayload): Promise<PayLinkPayResponse> {
  const { data } = await apiClient.post<import('@/types').ApiResponse<PayLinkPayResponse>>(
    ENDPOINTS.PAYLINK.PAY(token),
    payload,
  )
  return data.data
}

export async function getMyPayLinks(page = 1, pageSize = 20): Promise<MyLinksResponse> {
  const { data } = await apiClient.get<import('@/types').ApiResponse<MyLinksResponse>>(
    ENDPOINTS.PAYLINK.MY,
    { params: { page, pageSize } },
  )
  return data.data
}

export async function cancelPayLink(token: string): Promise<void> {
  await apiClient.delete(ENDPOINTS.PAYLINK.CANCEL(token))
}
