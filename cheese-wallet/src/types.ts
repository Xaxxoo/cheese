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
  firstName: string
  lastName: string
  fullName?: string
  phone?: string
  username: string
  profileImage?: string
  tier?: 'silver' | 'gold' | 'black'
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected'
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
  type: 'signup' | 'forgot-password'
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
  address: string
  chain: string
  network: string
}

export interface DepositNetwork {
  id: string
  name: string
  symbol: string
  decimals: number
  minAmount: string
  maxAmount: string
  fee: string
  estimatedTime: string
}

// ── Transaction Types ─────────────────────────────────────
export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'send' | 'receive'
  status: 'pending' | 'completed' | 'failed'
  amount: string
  amountUSD: string
  currency: string
  from?: string
  to?: string
  hash?: string
  timestamp: string
  description?: string
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
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
}

export interface BankTransferPayload {
  bankCode: string
  accountNumber: string
  accountName: string
  amount: string
  amountUSD: string
  narration?: string
  pin: string
  deviceSignature: string
  deviceId: string
}

export interface BankTransferResponse {
  id: string
  status: 'pending' | 'completed' | 'failed'
  amount: string
  amountUSD: string
  bankCode: string
  accountNumber: string
  accountName: string
  timestamp: string
  reference: string
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
  pair: string
  rate: string
  timestamp: string
  source: string
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
