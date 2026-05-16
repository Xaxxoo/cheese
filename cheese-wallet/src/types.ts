// ─────────────────────────────────────────────────────────
// CHEESE PAY — Type Definitions
// ─────────────────────────────────────────────────────────

// ── API Response Wrapper ──────────────────────────────────
export interface ApiResponse<T> {
  statusCode: number
  message: string
  data: T
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
}

// ── Auth Types ────────────────────────────────────────────
export interface User {
  id: string
  email: string
  fullName: string | null
  phone?: string
  username: string
  profileImage?: string
  tier?: 'silver' | 'gold' | 'black'
  kycStatus?: 'pending' | 'submitted' | 'verified' | 'rejected'
  createdAt: string
  emailVerified?: boolean
  phoneVerified?: boolean
  stellarPublicKey?: string | null
  evmAddress?: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface DeviceKey {
  deviceId: string
  publicKey: string
  deviceName?: string
  registeredAt?: string
  createdAt?: string
}

export interface LoginPayload {
  identifier: string   // email or username
  password: string
  deviceId: string
  deviceSignature: string
}

export interface SignupPayload {
  fullName: string
  email: string
  phone: string
  username: string
  password: string
  devicePublicKey: string
  deviceId: string
  referralCode?: string
}

export interface OtpVerifyPayload {
  email: string
  otp: string
  type: 'email_verify' | 'password_reset'
}

export interface ResetPasswordPayload {
  email: string
  otp: string
  newPassword: string
}

// ── Wallet Types ──────────────────────────────────────────
export interface WalletBalance {
  stellarUsdc: string
  stellarUsdcDisplay: string
  evmUsdc: string
  evmUsdcDisplay: string
  totalUsdc: string
  totalUsdcDisplay: string
  ngnEquivalent: string
  ngnRate: number
  lastUpdated: string
}

export interface WalletAddress {
  stellarAddress: string
  evmAddress: string | null
  network: string
  asset: string
  memo: null
}

export interface DepositNetwork {
  id: string
  name: string
  asset: string
  fee: string
  minDeposit: string
  confirmations: number
  estimatedTime: string
  note: string
}

// ── Transaction Types ─────────────────────────────────────
export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'send_username' | 'send_address' | 'bank_transfer' | 'yield_credit' | 'referral_bonus' | 'card_payment' | 'fee' | 'pay_request'
  status: 'pending' | 'completed' | 'failed' | 'reversed'
  amountUsdc: string
  amountNgn: string | null
  fee: string
  rateApplied: string | null
  recipientUsername: string | null
  recipientAddress: string | null
  recipientName: string | null
  bank: string | null
  accountNumber: string | null
  txHash: string | null
  network: string | null
  reference: string
  description: string | null
  createdAt: string
}

export interface TransactionListResponse {
  items: Transaction[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Bank Types ────────────────────────────────────────────
export interface NigerianBank {
  id: string
  code: string
  name: string
  slug: string
}

export interface AccountResolvePayload {
  bankCode: string
  accountNumber: string
}

export interface AccountResolveResponse {
  accountName: string
  accountNumber: string
  bankCode: string
  bankName: string
  verified: boolean
}

export interface BankTransferPayload {
  bankCode: string
  accountNumber: string
  accountName: string
  amountNgn: string
  narration?: string
  pinHash: string
  deviceSignature: string
  deviceId: string
  timestamp?: string
  nonce?: string
}

export interface BankTransferResponse {
  reference: string
  providerReference?: string | null
  status: 'processing' | 'completed'
  message: string
  amountNgn: string
  amountUsdc: string
  rateApplied: string
  fee: string
  recipientName: string
  bankName: string
  stellarTxHash: string
  createdAt: string
}

// ── Card Types ────────────────────────────────────────────
export interface VirtualCard {
  id: string
  cardNumber: string
  expiryDate: string
  cvv: string
  holderName: string
  status: 'active' | 'inactive' | 'frozen'
  balance: string
  currency: string
  createdAt: string
  limits: {
    daily: string
    monthly: string
    perTransaction: string
  }
}

// ── Rates Types ───────────────────────────────────────────
export interface ExchangeRate {
  id: string
  usdToNgn: string
  effectiveRate: string
  spreadPercent: string
  source: string
  fetchedAt: string
}

// ── Earn / Yield Types ────────────────────────────────────
export interface EarnBalance {
  balance: number
  earnedMonth: number
  earnedTotal: number
  apy: number
  protocol: string
  compounding: string
}

// ── Referral Types ────────────────────────────────────────
export interface ReferralInfo {
  code: string
  link: string
  totalReferrals: number
  pendingReward: number
  paidReward: number
}

// ── PayLink Types ─────────────────────────────────────────
export interface CreatePayLinkPayload {
  amount: string
  amountUSD: string
  description?: string
  expiresIn?: number // seconds
  metadata?: Record<string, unknown>
}

export interface CreatePayLinkResponse {
  token: string
  link: string
  amount: string
  expiresAt: string
}

export interface PayLinkData {
  token: string
  amount: string
  amountUSD: string
  description?: string
  creatorUsername: string
  expiresAt: string
  status: 'active' | 'expired' | 'completed'
  paidAt?: string
}

export interface PayLinkPayPayload {
  pin: string
  deviceSignature: string
  deviceId: string
}

export interface PayLinkPayResponse {
  id: string
  status: 'completed'
  amount: string
  timestamp: string
  reference: string
}

export interface MyLinksResponse {
  links: Array<CreatePayLinkResponse & { status: string; paidAt?: string }>
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
