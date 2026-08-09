// src/bridge/bridge.config.ts
import { registerAs } from '@nestjs/config';

// ── Static country configuration ─────────────────────────────────────────────
// Each entry maps an ISO alpha-2 country code to its fiat currency, payment
// rail used by Bridge, and per-transfer limits / fees.
export interface BridgeCountryConfig {
  code: string;
  name: string;
  currency: string;
  paymentRail: string;
  minTransferUsdc: number;
  maxTransferUsdc: number;
  feePercent: number;
}

export const BRIDGE_COUNTRIES: Record<string, BridgeCountryConfig> = {
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    paymentRail: 'mpesa',
    minTransferUsdc: 1,
    maxTransferUsdc: 500,
    feePercent: 1.5,
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    currency: 'GHS',
    paymentRail: 'bank_transfer',
    minTransferUsdc: 1,
    maxTransferUsdc: 500,
    feePercent: 1.5,
  },
  RW: {
    code: 'RW',
    name: 'Rwanda',
    currency: 'RWF',
    paymentRail: 'mobile_money',
    minTransferUsdc: 1,
    maxTransferUsdc: 500,
    feePercent: 2,
  },
  ET: {
    code: 'ET',
    name: 'Ethiopia',
    currency: 'ETB',
    paymentRail: 'bank_transfer',
    minTransferUsdc: 1,
    maxTransferUsdc: 500,
    feePercent: 2,
  },
};

export function getBridgeCountryConfig(
  code: string,
): BridgeCountryConfig | undefined {
  return BRIDGE_COUNTRIES[code.toUpperCase()];
}

export function isBridgeCountry(code: string): boolean {
  return code.toUpperCase() in BRIDGE_COUNTRIES;
}

// ── Environment-based config ─────────────────────────────────────────────────
export const bridgeConfig = registerAs('bridge', () => ({
  apiKey: process.env.BRIDGE_API_KEY || '',
  baseUrl:
    process.env.BRIDGE_BASE_URL || 'https://api.bridge.xyz',
  webhookSecret: process.env.BRIDGE_WEBHOOK_SECRET || '',
}));
