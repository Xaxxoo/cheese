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
  code?: string
  [key: string]: unknown
}

// ── Auth ──────────────────────────────────────────────────
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
  stellarWalletStatus?: 'pending' | 'active' | 'failed'
  evmAddress?: string | null
  evmWalletStatus?: 'pending' | 'active' | 'failed'
  hasPin?: boolean
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
  identifier: string
  password: string
  deviceId: string
  deviceSignature: string
  keyRecovery?: boolean
  newPublicKey?: string
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

// ── Wallet ────────────────────────────────────────────────
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

export type DepositTokenSymbol = 'USDC' | 'USDT'

export interface DepositToken {
  symbol: DepositTokenSymbol
  address: string | null
  decimals: number
}

export interface EvmDepositAddress {
  address: string | null
  chainId: number
  chainName: string
  displayName: string
  status: 'pending' | 'active' | 'suspended' | 'revoked' | 'missing'
  tokens: DepositToken[]
}

export interface WalletAddress {
  stellarAddress: string
  evmAddress: string | null
  evmSharedAddress: string | null
  evmAddresses: Record<number, EvmDepositAddress>
  evmChains: EvmDepositAddress[]
  assets: DepositTokenSymbol[]
  asset: 'USDC'
  memo: null
}

export interface DepositNetwork {
  id: string
  name: string
  networkType?: 'stellar' | 'evm'
  chainId?: number | null
  chainName?: string
  displayName?: string
  asset: string
  assets?: DepositTokenSymbol[]
  tokens?: DepositToken[]
  fee: string
  minDeposit: string
  confirmations: number
  estimatedTime: string
  note: string
}

// ── Transactions ──────────────────────────────────────────
export interface Transaction {
  id: string
  type:
    | 'deposit'
    | 'withdrawal'
    | 'send_username'
    | 'send_address'
    | 'bank_transfer'
    | 'yield_credit'
    | 'referral_bonus'
    | 'card_payment'
    | 'fee'
    | 'pay_request'
    | 'bill_payment'
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

export interface TransactionStats {
  totalInUsdc:  string
  totalOutUsdc: string
  txCount:      number
}

// ── Bank ──────────────────────────────────────────────────
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

// ── Send ──────────────────────────────────────────────────
export interface SendToUsernamePayload {
  username: string
  amountUsdc: string
  pinHash: string
  deviceId: string
  deviceSignature: string
}

export interface SendToAddressPayload {
  address: string
  amountUsdc: string
  pinHash: string
  deviceId: string
  deviceSignature: string
  network?: string
  memo?: string
}

// ── Recent Recipients ────────────────────────────────────
export interface RecentRecipient {
  type: string
  recipientUsername: string | null
  recipientName: string | null
  recipientAddress: string | null
  network: string | null
  bankName: string | null
  accountNumber: string | null
  lastSentAt: string
}

// ── Card ──────────────────────────────────────────────────
export interface VirtualCard {
  id:               string
  last4:            string
  maskedNumber:     string
  expiry:           string
  expiryMonth:      string
  expiryYear:       string
  holderName:       string
  network:          string
  status:           'active' | 'frozen' | 'terminated'
  availableBalance: string
  monthlySpend:     string
  spendLimit:       string
}

// ── Exchange Rate ─────────────────────────────────────────
export interface ExchangeRate {
  id: string
  usdToNgn: string
  effectiveRate: string
  spreadPercent: string
  source: string
  fetchedAt: string
}

// ── Earn ──────────────────────────────────────────────────
export interface EarnBalance {
  balance: number
  earnedMonth: number
  earnedTotal: number
  apy: number
  protocol: string
  compounding: string
}

// ── Referral ──────────────────────────────────────────────
export interface ReferralInfo {
  code: string
  link: string
  totalReferrals: number
  pendingReward: number
  paidReward: number
}

// ── PayLink ───────────────────────────────────────────────
export interface CreatePayLinkPayload {
  amountUsdc: string
  note?: string
  expiresInHours?: number
}

export interface CreatePayLinkResponse {
  id: string
  url: string
  token: string
  amountUsdc: string
  note: string | null
  expiresAt: string
  expiresInHours: number
}

export interface PayLinkData {
  id: string
  token: string
  url: string
  amountUsdc: string
  note: string | null
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  expiresAt: string
  createdAt: string
  creator: { username: string; fullName: string }
  payer: { username: string } | null
  paidAt: string | null
}

export interface PayLinkPayPayload {
  pinHash: string
  deviceId: string
  deviceSignature: string
}

// ── Bills ─────────────────────────────────────────────────
export interface BillVariation {
  variationCode: string
  name: string
  variationAmount: string
  fixedPrice: 'Yes' | 'No'
}

export interface PayBillPayload {
  serviceId: string
  billersCode: string
  variationCode?: string
  amount?: string
  pinHash: string
  deviceSignature: string
  deviceId: string
  timestamp: string
  nonce: string
}

export interface PayBillResponse {
  reference: string
  status: 'pending' | 'completed'
  transactionId: string
  amountUsdc: string
  amountNgn: string
  token?: string
  units?: string
  createdAt: string
}

// ── Devices ───────────────────────────────────────────────
export interface DeviceSummary {
  id:         string
  deviceName: string
  lastSeen:   string
  location?:  string
  isCurrent:  boolean
}

// ── On-Ramp ───────────────────────────────────────────────
export interface VirtualAccount {
  accountNumber: string
  accountName: string
}

export interface OnRampAvailability {
  availableUsdc: string
  availableUsdcDisplay: string
}

// ── Notifications ─────────────────────────────────────────
export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}
