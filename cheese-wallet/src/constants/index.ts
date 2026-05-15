// ─────────────────────────────────────────────────────────
// CHEESE PAY — API Constants & Endpoint Registry
// ─────────────────────────────────────────────────────────

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.cheesepay.xyz/v1'

export const ENDPOINTS = {
  // ── Auth ──────────────────────────────────────────────
  AUTH: {
    LOGIN:            '/auth/login',
    LOGOUT:           '/auth/logout',
    REFRESH:          '/auth/refresh',
    SIGNUP:           '/auth/signup',
    VERIFY_OTP:       '/auth/verify-otp',
    RESEND_OTP:       '/auth/resend-otp',
    FORGOT_PASSWORD:  '/auth/forgot-password',
    RESET_PASSWORD:   '/auth/reset-password',
    ME:               '/auth/me',
    VERIFY_PIN:       '/auth/verify-pin',
    SET_PIN:          '/auth/set-pin',
    CHANGE_PIN:       '/auth/change-pin',
    RESET_PIN:        '/auth/reset-pin',
  },

  // ── Admin Auth ────────────────────────────────────────
  ADMIN_AUTH: {
    LOGIN:           '/admin/auth/login',
    LOGOUT:          '/admin/auth/logout',
    REFRESH:         '/admin/auth/refresh',
    ME:              '/admin/auth/me',
    ADMINS:          '/admin/auth/admins',
    ADMIN_ROLE:      (id: string) => `/admin/auth/admins/${id}/role`,
    ADMIN_ID:        (id: string) => `/admin/auth/admins/${id}`,
    CHANGE_PASSWORD: '/admin/auth/change-password',
  },

  // ── Admin Rates ───────────────────────────────────────
  ADMIN_RATES: {
    CURRENT:  '/admin/rates',
    SET:      '/admin/rates',
  },

  // ── Device ────────────────────────────────────────────
  DEVICE: {
    REGISTER:         '/devices/register',
    LIST:             '/devices',
    REVOKE:           (id: string) => `/devices/${id}` as const,
  },

  // ── Wallet ────────────────────────────────────────────
  WALLET: {
    BALANCE:          '/wallet/balance',
    ADDRESS:          '/wallet/address',
    DEPOSIT_NETWORKS: '/wallet/deposit-networks',
  },

  // ── Transactions ──────────────────────────────────────
  TRANSACTIONS: {
    LIST:             '/transactions',
    BY_ID:            (id: string) => `/transactions/${id}`,
    RECEIPT:          (id: string) => `/transactions/${id}/receipt`,
  },

  // ── Send (USDC) ───────────────────────────────────────
  SEND: {
    TO_USERNAME:      '/send/username',
    TO_ADDRESS:       '/send/address',
    RESOLVE_USERNAME: (username: string) => `/send/resolve/${username}`,
    FEE_RATE:         '/send/fee-rate',
    ESTIMATE_FEE:     '/send/estimate-fee',
  },

  // ── Bank Transfer (NGN out) ───────────────────────────
  BANK: {
    LIST:             '/banks',
    RESOLVE_ACCOUNT:  '/banks/resolve',
    TRANSFER:         '/banks/transfer',
    TRANSFER_STATUS:  (ref: string) => `/banks/transfer/${ref}`,
  },

  // ── Exchange Rate ─────────────────────────────────────
  RATES: {
    CURRENT:          '/rates/current',
  },

  // ── Virtual Card ──────────────────────────────────────
  CARD: {
    DETAILS:          '/card',
    FREEZE:           '/card/freeze',
    UNFREEZE:         '/card/unfreeze',
    CVV:              '/card/cvv',
    TRANSACTIONS:     '/card/transactions',
  },

  // ── Notifications ────────────────────────────────────
  NOTIFICATIONS: {
    LIST:             '/notifications',
    MARK_READ:        '/notifications/read',
  },

  // ── Devices ───────────────────────────────────────────
  // (DEVICE already exists above, extending with List)

  // ── Yield / Earn ─────────────────────────────────────
  EARN: {
    BALANCE:          '/earn/balance',
    HISTORY:          '/earn/history',
  },

  // ── Referral ─────────────────────────────────────────
  REFERRAL: {
    INFO:             '/referral',
  },

  // ── Profile / KYC ────────────────────────────────────
  PROFILE: {
    GET:              '/profile',
    UPDATE:           '/profile',
    KYC_INIT:         '/profile/kyc',
    KYC_STATUS:       '/profile/kyc/status',
    UPLOAD_SELFIE:    '/profile/kyc/selfie',
    CHANGE_PASSWORD:  '/profile/change-password',
    CHANGE_PIN:       '/profile/change-pin',
  },

  // ── PayLink ───────────────────────────────────────────
  PAYLINK: {
    CREATE:           '/paylink',
    MY:               '/paylink/my',
    RESOLVE:          (token: string) => `/paylink/${token}`,
    PAY:              (token: string) => `/paylink/${token}/pay`,
    CANCEL:           (token: string) => `/paylink/${token}`,
  },
} as const

// ── React Query Keys ──────────────────────────────────────
// Centralised so invalidation is consistent across the app
export const QUERY_KEYS = {
  // Auth
  ME:                   ['auth', 'me'] as const,

  // Wallet
  BALANCE:              ['wallet', 'balance'] as const,
  ADDRESS:              ['wallet', 'address'] as const,
  DEPOSIT_NETWORKS:     ['wallet', 'deposit-networks'] as const,

  // Transactions
  TRANSACTIONS:         (page: number) => ['transactions', page] as const,
  TRANSACTION:          (id: string)   => ['transactions', id] as const,

  // Send
  RESOLVE_USERNAME:     (u: string)    => ['resolve', 'username', u] as const,
  SEND_FEE_RATE:        ['send', 'fee-rate'] as const,

  // Banks
  BANKS:                ['banks'] as const,
  RESOLVE_ACCOUNT:      (acct: string, code: string) => ['resolve', 'account', acct, code] as const,

  // Rates
  EXCHANGE_RATE:        ['rates', 'current'] as const,

  // Card
  CARD:                 ['card'] as const,
  CARD_TRANSACTIONS:    ['card', 'transactions'] as const,

  // Profile
  PROFILE:              ['profile'] as const,

  // Earn
  EARN_BALANCE:         ['earn', 'balance'] as const,
  EARN_HISTORY:         ['earn', 'history'] as const,

  // Notifications
  NOTIFICATIONS:        ['notifications'] as const,

  // Referral
  REFERRAL:             ['referral'] as const,

  // Devices
  DEVICES:              ['devices'] as const,

  // PayLink
  PAYLINK_MY:           ['paylink', 'my'] as const,
  PAYLINK_TOKEN:        (token: string) => ['paylink', token] as const,
} as const

// ── Stale times ───────────────────────────────────────────
export const STALE_TIMES = {
  BALANCE:          30_000,    // 30s  — refetch balance frequently
  EXCHANGE_RATE:    60_000,    // 1min
  TRANSACTIONS:     60_000,    // 1min
  BANKS:            86_400_000,// 24h  — bank list barely changes
  PROFILE:          300_000,   // 5min
  CARD:             60_000,    // 1min
  NOTIFICATIONS:    30_000,    // 30s
  EARN:             60_000,    // 1min
} as const
