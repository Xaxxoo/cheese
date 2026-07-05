import client from './client'
import type {
  ApiResponse,
  WalletBalance, WalletAddress, DepositNetwork,
  Transaction, TransactionListResponse, TransactionStats,
  NigerianBank, AccountResolvePayload, AccountResolveResponse,
  BankTransferPayload, BankTransferResponse,
  SendToUsernamePayload, SendToAddressPayload,
  ExchangeRate, EarnBalance, ReferralInfo,
  VirtualCard,
  VirtualAccount, OnRampAvailability,
  CreatePayLinkPayload, CreatePayLinkResponse,
  PayLinkData, PayLinkPayPayload,
  AppNotification,
} from '../types'

// ── Wallet ────────────────────────────────────────────────
export async function getBalance(): Promise<WalletBalance> {
  const { data } = await client.get<ApiResponse<WalletBalance>>('/wallet/balance')
  return data.data
}

export async function getWalletAddress(): Promise<WalletAddress> {
  const { data } = await client.get<ApiResponse<WalletAddress>>('/wallet/address')
  return data.data
}

export async function getDepositNetworks(): Promise<DepositNetwork[]> {
  const { data } = await client.get<ApiResponse<DepositNetwork[]>>('/wallet/deposit-networks')
  return data.data
}

// ── Transactions ──────────────────────────────────────────
export async function getTransactions(page = 1, pageSize = 20): Promise<TransactionListResponse> {
  const { data } = await client.get<ApiResponse<TransactionListResponse>>('/transactions', {
    params: { page, limit: pageSize },
  })
  return data.data
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data } = await client.get<ApiResponse<Transaction>>(`/transactions/${id}`)
  return data.data
}

export async function getTransactionStats(): Promise<TransactionStats> {
  const { data } = await client.get<ApiResponse<TransactionStats>>('/transactions/stats')
  return data.data
}

// ── Send ──────────────────────────────────────────────────
export async function resolveUsername(username: string): Promise<{ address: string; username: string }> {
  const { data } = await client.get<ApiResponse<{ address: string; username: string }>>(
    `/send/resolve/${username}`,
  )
  return data.data
}

export async function getSendFeeRate(): Promise<{ feeRate: number; feePct: string }> {
  const { data } = await client.get<ApiResponse<{ feeRate: number; feePct: string }>>('/send/fee-rate')
  return data.data
}

export async function sendToUsername(payload: SendToUsernamePayload): Promise<Transaction> {
  const { data } = await client.post<ApiResponse<Transaction>>('/send/username', payload)
  return data.data
}

export async function sendToAddress(payload: SendToAddressPayload): Promise<Transaction> {
  const { data } = await client.post<ApiResponse<Transaction>>('/send/address', payload)
  return data.data
}

// ── Bank ──────────────────────────────────────────────────
export async function getBanks(): Promise<NigerianBank[]> {
  const { data } = await client.get<ApiResponse<NigerianBank[]>>('/banks')
  return data.data
}

export async function resolveAccount(payload: AccountResolvePayload): Promise<AccountResolveResponse> {
  const { data } = await client.post<ApiResponse<AccountResolveResponse>>('/banks/resolve', payload)
  return data.data
}

export async function bankTransfer(payload: BankTransferPayload): Promise<BankTransferResponse> {
  const { data } = await client.post<ApiResponse<BankTransferResponse>>(
    '/banks/transfer', payload, { timeout: 60_000 },
  )
  return data.data
}

export async function syncBankTransferStatus(reference: string): Promise<{ reference: string; status: string; synced: boolean }> {
  const { data } = await client.post<ApiResponse<{ reference: string; status: string; synced: boolean }>>(
    `/banks/transfer/${reference}/status`,
  )
  return data.data
}

// ── On-Ramp ───────────────────────────────────────────────
export async function getVirtualAccount(): Promise<VirtualAccount> {
  const { data } = await client.get<ApiResponse<VirtualAccount>>('/banks/virtual-account')
  return data.data
}

export async function getOnRampAvailability(): Promise<OnRampAvailability> {
  const { data } = await client.get<ApiResponse<OnRampAvailability>>('/banks/onramp-availability')
  return data.data
}

// ── Rates ─────────────────────────────────────────────────
export async function getExchangeRate(): Promise<ExchangeRate> {
  const { data } = await client.get<ApiResponse<ExchangeRate>>('/rates/current')
  return data.data
}

// ── Earn ──────────────────────────────────────────────────
export async function getEarnBalance(): Promise<EarnBalance> {
  const { data } = await client.get<ApiResponse<EarnBalance>>('/earn/balance')
  return data.data
}

// ── Referral ──────────────────────────────────────────────
export async function getReferralInfo(): Promise<ReferralInfo> {
  const { data } = await client.get<ApiResponse<ReferralInfo>>('/referral/info')
  return data.data
}

// ── KYC ──────────────────────────────────────────────────
export async function verifyBvn(bvn: string): Promise<{ kycStatus: string; tier: string }> {
  const { data } = await client.post<ApiResponse<{ kycStatus: string; tier: string }>>('/kyc/bvn', { bvn })
  return data.data
}

export async function verifyNin(nin: string): Promise<{ kycStatus: string; tier: string }> {
  const { data } = await client.post<ApiResponse<{ kycStatus: string; tier: string }>>('/kyc/nin', { nin })
  return data.data
}

// ── Card ──────────────────────────────────────────────────
export async function getCard(): Promise<VirtualCard> {
  const { data } = await client.get<ApiResponse<VirtualCard>>('/cards')
  return data.data
}

export async function freezeCard(): Promise<VirtualCard> {
  const { data } = await client.post<ApiResponse<VirtualCard>>('/cards/freeze')
  return data.data
}

export async function unfreezeCard(): Promise<VirtualCard> {
  const { data } = await client.post<ApiResponse<VirtualCard>>('/cards/unfreeze')
  return data.data
}

// ── Notifications ─────────────────────────────────────────
export async function getNotifications(): Promise<AppNotification[]> {
  const { data } = await client.get<ApiResponse<AppNotification[]>>('/notifications')
  return data.data
}

export async function markNotificationsRead(): Promise<void> {
  await client.post('/notifications/read')
}

export async function registerExpoToken(token: string): Promise<void> {
  await client.post('/notifications/expo-token', { token })
}

export async function removeExpoToken(token: string): Promise<void> {
  await client.delete('/notifications/expo-token', { data: { token } })
}

// ── PayLink ───────────────────────────────────────────────
export async function createPayLink(payload: CreatePayLinkPayload): Promise<CreatePayLinkResponse> {
  const { data } = await client.post<ApiResponse<CreatePayLinkResponse>>('/paylink', payload)
  return data.data
}

export async function getMyPayLinks(page = 1, pageSize = 20): Promise<{ data: PayLinkData[]; total: number; page: number; pageSize: number }> {
  const { data } = await client.get<ApiResponse<{ data: PayLinkData[]; total: number; page: number; pageSize: number }>>(
    '/paylink/my', { params: { page, limit: pageSize } },
  )
  return data.data
}

export async function resolvePayLink(token: string): Promise<PayLinkData> {
  const { data } = await client.get<ApiResponse<PayLinkData>>(`/paylink/${token}`)
  return data.data
}

export async function payPayLink(token: string, payload: PayLinkPayPayload): Promise<{ txId: string; txHash: string; amountUsdc: string; fee: string; paidAt: string }> {
  const { data } = await client.post<ApiResponse<{ txId: string; txHash: string; amountUsdc: string; fee: string; paidAt: string }>>(
    `/paylink/${token}/pay`, payload,
  )
  return data.data
}

export async function cancelPayLink(token: string): Promise<void> {
  await client.post(`/paylink/${token}/cancel`)
}
