'use client';

import merchantApiClient, { merchantTokenStore } from './merchant-client';
import type {
  ApiKey,
  ApiKeysPayload,
  MerchantDashboardPayload,
  MerchantSession,
  Payment,
  PaymentDetailPayload,
  PaymentRequestDraft,
  PaymentRequestPreview,
  SettlementsPayload,
  Webhook,
  WebhookDelivery,
} from '../types';

// All responses from the NestJS backend are wrapped: { data: T }
function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function beginMerchantLogin(payload: {
  email: string;
  password: string;
}): Promise<{ challengeId: string; email: string; method: string }> {
  const res = await merchantApiClient.post<{ data: { challengeId: string; email: string; method: string } }>(
    '/merchant/auth/login',
    { email: payload.email, password: payload.password },
  );
  return unwrap(res);
}

export async function registerMerchant(payload: {
  fullName: string;
  email: string;
  password: string;
  businessName: string;
  country: string;
  baseCurrency: string;
  settlementMode: MerchantSession['merchant']['defaultSettlementMode'];
}): Promise<{ email: string; verificationSent: boolean }> {
  const res = await merchantApiClient.post<{ data: { email: string; verificationSent: boolean } }>(
    '/merchant/auth/register',
    payload,
  );
  return unwrap(res);
}

export async function verifyMerchantEmail(payload: {
  email: string;
  code: string;
}): Promise<{ verified: boolean; email: string }> {
  const res = await merchantApiClient.post<{ data: { verified: boolean; email: string } }>(
    '/merchant/auth/verify-email',
    payload,
  );
  return unwrap(res);
}

export async function completeMerchantTwoFactor(payload: {
  email: string;
  code: string;
}): Promise<MerchantSession> {
  const res = await merchantApiClient.post<{
    data: Omit<MerchantSession, 'accessToken'> & { accessToken: string };
  }>('/merchant/auth/2fa', payload);
  const session = unwrap(res);

  // Store the access token for subsequent requests
  if (session.accessToken) {
    merchantTokenStore.set(session.accessToken);
  }

  return session;
}

export async function requestMerchantPasswordReset(payload: {
  email: string;
}): Promise<{ sent: boolean }> {
  const res = await merchantApiClient.post<{ data: { sent: boolean } }>(
    '/merchant/auth/forgot-password',
    payload,
  );
  return unwrap(res);
}

export async function completeMerchantOnboarding(payload: {
  merchantType: MerchantSession['merchant']['merchantType'];
  country: string;
  baseCurrency: string;
  settlementMode: MerchantSession['merchant']['defaultSettlementMode'];
  payoutSchedule: MerchantSession['merchant']['payoutSchedule'];
  storeName: string;
}): Promise<Partial<MerchantSession>> {
  const res = await merchantApiClient.patch<{ data: Partial<MerchantSession> }>(
    '/merchant/auth/onboarding',
    payload,
  );
  return unwrap(res);
}

export async function getMerchantMe(): Promise<Partial<MerchantSession>> {
  const res = await merchantApiClient.get<{ data: Partial<MerchantSession> }>(
    '/merchant/auth/me',
  );
  return unwrap(res);
}

export async function logoutMerchant(): Promise<void> {
  await merchantApiClient.post('/merchant/auth/logout');
  merchantTokenStore.clear();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getMerchantDashboard(): Promise<MerchantDashboardPayload> {
  const res = await merchantApiClient.get<{ data: MerchantDashboardPayload }>(
    '/merchant/dashboard',
  );
  return unwrap(res);
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function listMerchantPayments(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<Payment[]> {
  const res = await merchantApiClient.get<{ data: { payments: Payment[]; total: number } }>(
    '/merchant/payments',
    { params },
  );
  return unwrap(res).payments;
}

export async function getMerchantPayment(
  paymentId: string,
): Promise<PaymentDetailPayload> {
  const res = await merchantApiClient.get<{ data: PaymentDetailPayload }>(
    `/merchant/payments/${paymentId}`,
  );
  return unwrap(res);
}

export async function createMerchantPayment(
  draft: PaymentRequestDraft,
): Promise<{ payment: Payment; reference: string; checkoutUrl: string }> {
  const res = await merchantApiClient.post<{
    data: { payment: Payment; reference: string; checkoutUrl: string };
  }>('/merchant/payments', {
    kind: draft.kind,
    fiatAmount: Number(draft.fiatAmount),
    fiatCurrency: draft.fiatCurrency,
    customerName: draft.customerName || undefined,
    customerEmail: draft.customerEmail || undefined,
    settlementMode: draft.settlementMode,
    settlementCurrency: draft.settlementCurrency,
    expirationMinutes: draft.expirationMinutes,
    callbackUrl: draft.callbackUrl || undefined,
    metadata: draft.metadata ? JSON.parse(draft.metadata) : undefined,
  });
  return unwrap(res);
}

// ── Settlements ────────────────────────────────────────────────────────────────

export async function listMerchantSettlements(): Promise<SettlementsPayload> {
  const res = await merchantApiClient.get<{ data: SettlementsPayload }>(
    '/merchant/settlements',
  );
  return unwrap(res);
}

// ── Payout accounts ────────────────────────────────────────────────────────────

export async function addMerchantPayoutAccount(payload: {
  label: string;
  accountType: 'bank' | 'digital_dollar';
  currency: string;
  destination: string;
}): Promise<{ payoutAccount: import('../types').PayoutAccount }> {
  const res = await merchantApiClient.post<{ data: { payoutAccount: import('../types').PayoutAccount } }>(
    '/merchant/payout-accounts',
    payload,
  );
  return unwrap(res);
}

export async function updateMerchantPayoutAccount(
  id: string,
  payload: { label: string },
): Promise<{ payoutAccount: import('../types').PayoutAccount }> {
  const res = await merchantApiClient.patch<{ data: { payoutAccount: import('../types').PayoutAccount } }>(
    `/merchant/payout-accounts/${id}`,
    payload,
  );
  return unwrap(res);
}

export async function removeMerchantPayoutAccount(id: string): Promise<{ removed: boolean }> {
  const res = await merchantApiClient.delete<{ data: { removed: boolean } }>(
    `/merchant/payout-accounts/${id}`,
  );
  return unwrap(res);
}

export async function setDefaultMerchantPayoutAccount(
  id: string,
): Promise<{ payoutAccount: import('../types').PayoutAccount }> {
  const res = await merchantApiClient.patch<{ data: { payoutAccount: import('../types').PayoutAccount } }>(
    `/merchant/payout-accounts/${id}/set-default`,
  );
  return unwrap(res);
}

// ── API Keys ───────────────────────────────────────────────────────────────────

export async function listMerchantApiKeys(): Promise<ApiKeysPayload> {
  const res = await merchantApiClient.get<{ data: ApiKeysPayload }>('/merchant/api-keys');
  return unwrap(res);
}

export async function createMerchantApiKey(payload: {
  name: string;
  scopes: string[];
}): Promise<{ apiKey: ApiKey }> {
  const res = await merchantApiClient.post<{ data: { apiKey: ApiKey } }>(
    '/merchant/api-keys',
    payload,
  );
  return unwrap(res);
}

export async function revokeMerchantApiKey(id: string): Promise<{ apiKey: ApiKey }> {
  const res = await merchantApiClient.delete<{ data: { apiKey: ApiKey } }>(
    `/merchant/api-keys/${id}`,
  );
  return unwrap(res);
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

export async function listMerchantWebhooks(): Promise<{ webhooks: Webhook[] }> {
  const res = await merchantApiClient.get<{ data: { webhooks: Webhook[] } }>('/merchant/webhooks');
  return unwrap(res);
}

export async function createMerchantWebhook(payload: {
  url: string;
  description?: string;
  events: string[];
}): Promise<{ webhook: Webhook }> {
  const res = await merchantApiClient.post<{ data: { webhook: Webhook } }>(
    '/merchant/webhooks',
    payload,
  );
  return unwrap(res);
}

export async function updateMerchantWebhook(
  id: string,
  payload: { url?: string; description?: string; events?: string[]; enabled?: boolean },
): Promise<{ webhook: Webhook }> {
  const res = await merchantApiClient.patch<{ data: { webhook: Webhook } }>(
    `/merchant/webhooks/${id}`,
    payload,
  );
  return unwrap(res);
}

export async function deleteMerchantWebhook(id: string): Promise<{ removed: boolean }> {
  const res = await merchantApiClient.delete<{ data: { removed: boolean } }>(
    `/merchant/webhooks/${id}`,
  );
  return unwrap(res);
}

export async function getMerchantWebhookDeliveries(
  webhookId: string,
): Promise<{ deliveries: WebhookDelivery[] }> {
  const res = await merchantApiClient.get<{ data: { deliveries: WebhookDelivery[] } }>(
    `/merchant/webhooks/${webhookId}/deliveries`,
  );
  return unwrap(res);
}

// ── Customers (computed from payments) ────────────────────────────────────────

export async function listTopMerchantCustomers() {
  // Derive customer data from recent payments
  const payments = await listMerchantPayments({ limit: 100 });
  const customerMap = new Map<string, {
    id: string;
    name: string;
    email: string;
    paymentsCount: number;
    lifetimeValue: number;
    currency: string;
  }>();

  for (const p of payments) {
    if (!p.customerEmail || p.customerEmail === '—') continue;
    const key = p.customerEmail;
    const existing = customerMap.get(key);
    const amount = parseFloat(p.fiatAmount.replace(/[^0-9.]/g, '')) || 0;
    if (existing) {
      existing.paymentsCount++;
      existing.lifetimeValue += amount;
    } else {
      customerMap.set(key, {
        id: key,
        name: p.customerName !== 'Anonymous' ? p.customerName : key.split('@')[0],
        email: key,
        paymentsCount: 1,
        lifetimeValue: amount,
        currency: p.fiatCurrency,
      });
    }
  }

  return Array.from(customerMap.values())
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      paymentsCount: c.paymentsCount,
      lifetimeValue: `${c.currency === 'NGN' ? '₦' : '$'}${c.lifetimeValue.toLocaleString('en', { minimumFractionDigits: 2 })}`,
    }));
}

// ── Payment request preview (local computation — no round-trip needed) ────────

const FX_RATES: Record<string, number> = {
  NGN: 1520.42,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

export async function previewPaymentRequest(
  draft: PaymentRequestDraft,
): Promise<PaymentRequestPreview> {
  const baseRate = FX_RATES[draft.fiatCurrency] ?? 1;
  const fiatAmount = Number(draft.fiatAmount || 0);
  const quotedDigitalDollarAmount =
    draft.fiatCurrency === 'USD'
      ? fiatAmount
      : fiatAmount > 0
        ? fiatAmount / baseRate
        : 0;

  const ref = `CHP_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  return {
    reference: ref,
    checkoutUrl: `https://pay.cheesepay.xyz/c/${ref}`,
    quotedDigitalDollarAmount: `$${quotedDigitalDollarAmount.toFixed(2)}`,
    expiresLabel: `${draft.expirationMinutes} minutes after issue`,
    settlementDescription:
      draft.settlementMode === 'instant_fiat'
        ? `Instant payout in ${draft.settlementCurrency}`
        : 'Hold as digital dollar balance',
  };
}
