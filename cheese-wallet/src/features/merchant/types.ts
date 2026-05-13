export type MerchantRole =
  | 'owner'
  | 'admin'
  | 'finance'
  | 'ops'
  | 'support'
  | 'developer';

export type MerchantType = 'individual' | 'business';
export type SettlementMode = 'instant_fiat' | 'hold_usdc';
export type PayoutSchedule = 'instant' | 'daily' | 'weekly';
export type MerchantTheme = 'light' | 'dark';

export type PaymentStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'settling'
  | 'settled'
  | 'failed'
  | 'expired';

export type SettlementStatus =
  | 'queued'
  | 'settling'
  | 'settled'
  | 'failed';

export type PaymentRequestKind =
  | 'payment_link'
  | 'invoice'
  | 'checkout_session'
  | 'qr_static'
  | 'qr_dynamic'
  | 'api_request';

export interface MerchantUser {
  id: string;
  fullName: string;
  email: string;
  role: MerchantRole;
  permissions: string[];
  twoFactorEnabled: boolean;
  lastLoginAt: string;
}

export interface MerchantStore {
  id: string;
  name: string;
  slug: string;
  location: string;
  currency: string;
  settlementMode: SettlementMode;
  payoutsEnabled: boolean;
}

export interface MerchantProfile {
  id: string;
  merchantType: MerchantType;
  displayName: string;
  legalName: string;
  country: string;
  baseCurrency: string;
  defaultSettlementMode: SettlementMode;
  payoutSchedule: PayoutSchedule;
  kycStatus: 'not_started' | 'review' | 'verified';
  kybStatus: 'not_required' | 'review' | 'verified';
  stores: MerchantStore[];
}

export interface MerchantSession {
  accessToken: string;
  sandboxMode: boolean;
  onboardingComplete: boolean;
  user: MerchantUser;
  merchant: MerchantProfile;
}

export interface MetricSummary {
  label: string;
  amount: string;
  trend: string;
  tone: 'positive' | 'neutral' | 'warning';
}

export interface RevenuePoint {
  label: string;
  gross: number;
  settled: number;
}

export interface BreakdownSlice {
  label: string;
  value: number;
  color: string;
  note: string;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  note: string;
  at: string;
  type: 'payment' | 'settlement' | 'risk' | 'api';
}

export interface MerchantDashboardPayload {
  summaries: MetricSummary[];
  revenueSeries: RevenuePoint[];
  networkUsage: BreakdownSlice[];
  settlementMix: BreakdownSlice[];
  recentActivity: RecentActivityItem[];
  averageSettlementSpeed: string;
}

export interface CustomerSnapshot {
  id: string;
  name: string;
  email: string;
  paymentsCount: number;
  lifetimeValue: string;
}

export interface Payment {
  id: string;
  reference: string;
  requestKind: PaymentRequestKind;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  storeName: string;
  fiatAmount: string;
  fiatCurrency: string;
  digitalDollarAmount: string;
  settlementMode: SettlementMode;
  settlementCurrency: string;
  network: string;
  speed: string;
  costEfficiency: string;
  status: PaymentStatus;
  metadata: Record<string, string>;
  callbackUrl: string;
  expiresAt: string;
}

export interface PaymentTimelineEvent {
  id: string;
  label: string;
  description: string;
  at: string;
  status: 'done' | 'current' | 'upcoming' | 'failed';
}

export interface PaymentDetailPayload {
  payment: Payment;
  timeline: PaymentTimelineEvent[];
  feeSummary: {
    processingFee: string;
    settlementFee: string;
    fxRate: string;
    payoutEta: string;
  };
}

export interface PayoutAccount {
  id: string;
  label: string;
  accountType: 'bank' | 'digital_dollar';
  currency: string;
  destination: string;
  status: 'active' | 'review';
  defaultForInstantPayout: boolean;
}

export interface Settlement {
  id: string;
  paymentReference: string;
  currency: string;
  grossAmount: string;
  netAmount: string;
  destination: string;
  schedule: PayoutSchedule;
  eta: string;
  status: SettlementStatus;
  createdAt: string;
  bankReference: string;
}

export interface SettlementsPayload {
  summaries: MetricSummary[];
  payoutAccounts: PayoutAccount[];
  settlements: Settlement[];
  currentFxRate: string;
  estimatedArrival: string;
}

export interface PaymentRequestDraft {
  kind: PaymentRequestKind;
  fiatAmount: string;
  fiatCurrency: string;
  customerName: string;
  customerEmail: string;
  settlementMode: SettlementMode;
  settlementCurrency: string;
  expirationMinutes: number;
  callbackUrl: string;
  metadata: string;
}

export interface PaymentRequestPreview {
  reference: string;
  checkoutUrl: string;
  quotedDigitalDollarAmount: string;
  expiresLabel: string;
  settlementDescription: string;
}
