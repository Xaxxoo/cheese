// ─────────────────────────────────────────────────────────
// CHEESE PAY — Global Type Definitions
// ─────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string | null;
  phone: string | null;
  tier: 'silver' | 'gold' | 'black';
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected';
  hasPin: boolean;
  createdAt: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isAdmin?: boolean;
  referralCode?: string | null;
  points?: number;
  stellarPublicKey?: string | null;
  stellarWalletStatus?: 'pending' | 'active' | 'failed';
  evmAddress?: string | null;
  evmWalletStatus?: 'pending' | 'active' | 'failed';
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DeviceKey {
  deviceId: string;
  publicKey: string;
  deviceName: string;
  registeredAt: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  deviceSignature: string;
  deviceId: string;
  keyRecovery?: boolean;
  newPublicKey?: string;
}

export interface SignupPayload {
  fullName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  devicePublicKey: string;
  deviceId: string;
  referralCode?: string;
}

export interface OtpVerifyPayload {
  email: string;
  otp: string;
  type:
    | 'email_verify'
    | 'password_reset'
    | 'phone_verify'
    | 'login_2fa'
    | 'device_register';
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
}

// ── Wallet ────────────────────────────────────────────────
export interface WalletBalance {
  usdc: string;
  usdcFormatted: string;
  ngnEquivalent: string;
  ngnRate: number;
  lastUpdated: string;
}

export interface WalletAddress {
  address: string;
  username: string;
  network: string;
}

// ── Transactions ──────────────────────────────────────────
export type TxType =
  | 'send'
  | 'receive'
  | 'bank_out'
  | 'bank_in'
  | 'deposit'
  | 'card_spend';
export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  amountUsdc: string; // always present; NGN amounts stored here as string too
  amountNgn?: string; // set for bank_out / bank_in
  fee: string;
  recipient?: string; // username for p2p, address for on-chain
  recipientName?: string; // display name
  recipientAddress?: string; // EVM address (on-chain sends)
  recipientIdentifier?: string; // canonical repeatable identifier (@username / 0x… / account#)
  bank?: string;
  accountNumber?: string;
  txHash?: string;
  network?: string; // 'arbitrum' | 'polygon' | 'base' etc.
  reference: string;
  createdAt: string;
  description?: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Bank Transfer ─────────────────────────────────────────
export interface NigerianBank {
  code: string;
  name: string;
  shortName: string;
  color: string;
  type: 'commercial' | 'microfinance' | 'fintech' | 'merchant';
  nipEnabled: boolean;
}

export interface AccountResolvePayload {
  accountNumber: string;
  bankCode: string;
}

export interface AccountResolveResponse {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  verified: boolean;
}

export interface BankTransferPayload {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  amountNgn: string;
  pinHash: string;
  deviceSignature: string;
  deviceId: string;
  timestamp?: string;
  nonce?: string;
}

export interface BankTransferResponse {
  reference: string;
  providerReference?: string | null;
  status: 'pending' | 'processing' | 'completed';
  message: string;
  amountNgn: string;
  amountUsdc: string;
  rateApplied: string;
  fee: string;
  recipientName: string;
  bankName: string;
  stellarTxHash: string;
  createdAt: string;
}

// ── Exchange Rate ─────────────────────────────────────────
export interface ExchangeRate {
  usdToNgn: number;
  effectiveRate: number;
  spread: number;
  fetchedAt: string;
  source: string;
}

// ── Deposit ───────────────────────────────────────────────
export interface DepositNetwork {
  id: string;
  name: string;
  symbol: string;
  color: string;
  shortName: string;
  address: string;
  fee: string;
  feeDisplay: string;
  isFeatured: boolean;
}

// ── Recent Recipients ────────────────────────────────────
export interface RecentRecipient {
  type: string;
  recipientUsername: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  network: string | null;
  bankName: string | null;
  accountNumber: string | null;
  lastSentAt: string;
}

// ── Card ──────────────────────────────────────────────────
export interface VirtualCard {
  id: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  holderName: string;
  maskedNumber: string;   // e.g. "•••• •••• •••• 1234"
  expiry: string;         // e.g. "09/27"
  network: 'visa' | 'mastercard';
  status: 'active' | 'frozen' | 'terminated';
  availableBalance: string;
  monthlySpend: string;
  spendLimit: string;
}

// ── API wrappers ──────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  code?: string;
  email?: string;
  [key: string]: unknown;
}

// ── UI ────────────────────────────────────────────────────
export type Theme = 'dark' | 'light';
export type AppScreen =
  | 'home'
  | 'send'
  | 'cards'
  | 'cardscreen'
  | 'history'
  | 'profile';
export type AuthScreen =
  | 'splash'
  | 'login'
  | 'signup-1'
  | 'signup-2'
  | 'signup-3'
  | 'signup-otp'
  | 'device'
  | 'forgot-email'
  | 'forgot-otp'
  | 'new-password'
  | 'pw-success';

// ── PayLink ───────────────────────────────────────────────
export type PayLinkStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface PayLinkCreator {
  username: string;
  fullName: string;
}

export interface PayLinkPayer {
  username: string;
}

export interface PayLinkData {
  id: string;
  token: string;
  url: string;
  amountUsdc: string;
  note: string | null;
  status: PayLinkStatus;
  expiresAt: string;
  createdAt: string;
  creator: PayLinkCreator;
  payer: PayLinkPayer | null;
  paidAt: string | null;
}

export interface CreatePayLinkPayload {
  amountUsdc: string;
  note?: string;
  expiresInHours?: number;
}

export interface CreatePayLinkResponse {
  id: string;
  url: string;
  token: string;
  amountUsdc: string;
  note: string | null;
  expiresAt: string;
  expiresInHours: number;
}

export interface PayLinkPayPayload {
  pinHash: string;
  deviceId: string;
  deviceSignature: string;
}

export interface PayLinkPayResponse {
  txId: string;
  txHash: string;
  amountUsdc: string;
  fee: string;
  paidAt: string;
}

export interface MyLinksResponse {
  data: PayLinkData[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Bank Deposits (NGN → USDC on-ramp) ────────────────────
export type DepositStatus = 'pending' | 'completed' | 'failed'

export interface BankDeposit {
  id: string
  reference: string
  amountNgn: string
  amountUsdc: string
  rateApplied: string
  senderName: string | null
  status: DepositStatus
  txHash: string | null
  failureReason: string | null
  createdAt: string
}

export interface DepositsResponse {
  items: BankDeposit[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
