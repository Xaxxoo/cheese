'use client';

import {
  customerSnapshotsSeed,
  dashboardSeed,
  merchantSessionSeed,
  paymentDetailsSeed,
  paymentsSeed,
  settlementsSeed,
} from '../data/seed';
import type {
  MerchantDashboardPayload,
  MerchantSession,
  Payment,
  PaymentDetailPayload,
  PaymentRequestDraft,
  PaymentRequestPreview,
  SettlementsPayload,
} from '../types';

const NETWORK_QUOTE_MAP: Record<string, number> = {
  NGN: 1520.42,
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

function pause(ms = 280) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function beginMerchantLogin(payload: {
  email: string;
  password: string;
}) {
  await pause();
  if (!payload.email || !payload.password) {
    throw new Error('Email and password are required.');
  }

  return {
    challengeId: 'mfa_challenge_demo',
    email: payload.email.toLowerCase(),
    method: 'authenticator',
  };
}

export async function registerMerchant(payload: {
  fullName: string;
  email: string;
  password: string;
  businessName: string;
  country: string;
  baseCurrency: string;
  settlementMode: MerchantSession['merchant']['defaultSettlementMode'];
}) {
  await pause();
  if (
    !payload.fullName ||
    !payload.email ||
    !payload.password ||
    !payload.businessName
  ) {
    throw new Error('Complete all required fields to create your account.');
  }

  return {
    email: payload.email.toLowerCase(),
    verificationSent: true,
  };
}

export async function verifyMerchantEmail(payload: {
  email: string;
  code: string;
}) {
  await pause();
  if (payload.code.length < 6) {
    throw new Error('Enter the 6-digit verification code.');
  }
  return { verified: true, email: payload.email.toLowerCase() };
}

export async function completeMerchantTwoFactor(payload: {
  email: string;
  code: string;
}) {
  await pause();
  if (payload.code.length < 6) {
    throw new Error('Authenticator code must be 6 digits.');
  }

  return clone({
    ...merchantSessionSeed,
    user: {
      ...merchantSessionSeed.user,
      email: payload.email.toLowerCase(),
    },
  });
}

export async function requestMerchantPasswordReset(payload: { email: string }) {
  await pause();
  if (!payload.email) {
    throw new Error('Enter your work email to continue.');
  }
  return { sent: true };
}

export async function completeMerchantOnboarding(payload: {
  merchantType: MerchantSession['merchant']['merchantType'];
  country: string;
  baseCurrency: string;
  settlementMode: MerchantSession['merchant']['defaultSettlementMode'];
  payoutSchedule: MerchantSession['merchant']['payoutSchedule'];
  storeName: string;
}) {
  await pause();
  if (!payload.country || !payload.baseCurrency || !payload.storeName) {
    throw new Error('Onboarding is missing required business details.');
  }

  return clone<Partial<MerchantSession>>({
    onboardingComplete: true,
    merchant: {
      ...merchantSessionSeed.merchant,
      merchantType: payload.merchantType,
      country: payload.country,
      baseCurrency: payload.baseCurrency,
      defaultSettlementMode: payload.settlementMode,
      payoutSchedule: payload.payoutSchedule,
      stores: [
        {
          ...merchantSessionSeed.merchant.stores[0],
          name: payload.storeName,
          currency: payload.baseCurrency,
          settlementMode: payload.settlementMode,
        },
        ...merchantSessionSeed.merchant.stores.slice(1),
      ],
    },
  });
}

export async function getMerchantDashboard(): Promise<MerchantDashboardPayload> {
  await pause();
  return clone(dashboardSeed);
}

export async function listMerchantPayments(): Promise<Payment[]> {
  await pause();
  return clone(paymentsSeed);
}

export async function getMerchantPayment(
  paymentId: string,
): Promise<PaymentDetailPayload> {
  await pause();

  const detail = paymentDetailsSeed[paymentId];
  if (detail) return clone(detail);

  const payment = paymentsSeed.find((item) => item.id === paymentId);
  if (!payment) {
    throw new Error('Payment record not found.');
  }

  return clone({
    payment,
    timeline: [
      {
        id: 'created',
        label: 'Request created',
        description: 'Merchant generated a new payment request.',
        at: payment.createdAt,
        status: 'done',
      },
      {
        id: 'status',
        label: 'Current status',
        description: `Payment is currently ${payment.status.replace(/_/g, ' ')}.`,
        at: payment.createdAt,
        status: payment.status === 'failed' ? 'failed' : 'current',
      },
    ],
    feeSummary: {
      processingFee: payment.fiatCurrency === 'NGN' ? '₦0.00' : '$0.00',
      settlementFee: payment.fiatCurrency === 'NGN' ? '₦0.00' : '$0.00',
      fxRate: 'Quoted at request creation',
      payoutEta: 'Depends on settlement preference',
    },
  });
}

export async function listMerchantSettlements(): Promise<SettlementsPayload> {
  await pause();
  return clone(settlementsSeed);
}

export async function listTopMerchantCustomers() {
  await pause();
  return clone(customerSnapshotsSeed);
}

export async function previewPaymentRequest(
  draft: PaymentRequestDraft,
): Promise<PaymentRequestPreview> {
  await pause(120);
  const baseRate = NETWORK_QUOTE_MAP[draft.fiatCurrency] ?? 1;
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
