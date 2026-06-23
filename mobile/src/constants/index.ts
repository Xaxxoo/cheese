export const API_URL = 'https://cheese-production-b7c1.up.railway.app/v1'

export const ENDPOINTS = {
  AUTH: {
    LOGIN:          '/auth/login',
    LOGOUT:         '/auth/logout',
    REFRESH:        '/auth/refresh',
    SIGNUP:         '/auth/signup',
    VERIFY_OTP:     '/auth/verify-otp',
    VERIFY_EMAIL:   '/auth/verify-email',
    RESEND_OTP:     '/auth/resend-otp',
    FORGOT_PASSWORD:'/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME:             '/auth/me',
    VERIFY_PIN:     '/auth/verify-pin',
    SET_PIN:        '/auth/set-pin',
    CHANGE_PIN:     '/auth/change-pin',
    RESET_PIN:      '/auth/reset-pin',
  },
  DEVICE: {
    REGISTER: '/devices/register',
    LIST:     '/devices',
    REVOKE:   (id: string) => `/devices/${id}`,
  },
  WALLET: {
    BALANCE:          '/wallet/balance',
    ADDRESS:          '/wallet/address',
    DEPOSIT_NETWORKS: '/wallet/deposit-networks',
  },
  TRANSACTIONS: {
    LIST:    '/transactions',
    BY_ID:   (id: string) => `/transactions/${id}`,
  },
  SEND: {
    TO_USERNAME:      '/send/username',
    TO_ADDRESS:       '/send/address',
    RESOLVE_USERNAME: (u: string) => `/send/resolve/${u}`,
    FEE_RATE:         '/send/fee-rate',
  },
  BANK: {
    LIST:            '/banks',
    RESOLVE_ACCOUNT: '/banks/resolve',
    TRANSFER:        '/banks/transfer',
    TRANSFER_STATUS: (ref: string) => `/banks/transfer/${ref}/status`,
  },
  RATES: {
    CURRENT: '/rates/current',
  },
  CARD: {
    DETAILS:  '/cards',
    FREEZE:   '/cards/freeze',
    UNFREEZE: '/cards/unfreeze',
    CVV:      '/cards/cvv',
  },
  NOTIFICATIONS: {
    LIST:      '/notifications',
    MARK_READ: '/notifications/read',
  },
  EARN: {
    BALANCE: '/earn/balance',
  },
  REFERRAL: {
    INFO: '/referral/info',
  },
  KYC: {
    VERIFY_BVN: '/kyc/bvn',
    VERIFY_NIN: '/kyc/nin',
  },
  PROFILE: {
    UPDATE: '/auth/profile',
  },
  PAYLINK: {
    CREATE:  '/paylink',
    MY:      '/paylink/my',
    RESOLVE: (token: string) => `/paylink/${token}`,
    PAY:     (token: string) => `/paylink/${token}/pay`,
    CANCEL:  (token: string) => `/paylink/${token}/cancel`,
  },
  BILLS: {
    VARIATIONS: '/bills/variations',
    VERIFY:     '/bills/verify',
    PAY:        '/bills/pay',
  },
}

// Colors
export const COLORS = {
  background: '#0a0a0a',
  surface:    '#141414',
  surfaceAlt: '#1a1a1a',
  border:     'rgba(255,255,255,0.08)',
  text:       '#ffffff',
  textMid:    'rgba(255,255,255,0.7)',
  textDim:    'rgba(255,255,255,0.35)',
  gold:       '#d4a843',
  goldDim:    'rgba(212,168,67,0.15)',
  green:      '#22c55e',
  greenDim:   'rgba(34,197,94,0.12)',
  red:        '#ef4444',
  redDim:     'rgba(239,68,68,0.12)',
  amber:      '#f59e0b',
  amberDim:   'rgba(245,158,11,0.12)',
  blue:       '#60a5fa',
}
