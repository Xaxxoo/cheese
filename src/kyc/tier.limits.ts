// src/kyc/tier.limits.ts
//
// Single source of truth for all tier-based limits.
// Update here and enforcement in Send / Banks / Cards picks it up automatically.

import { Tier } from '../auth/entities/user.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Daily limits
// ─────────────────────────────────────────────────────────────────────────────

export const DAILY_CRYPTO_LIMIT_USDC: Record<Tier, number> = {
  [Tier.SILVER]: 10_000,
  [Tier.GOLD]: 50_000,
  [Tier.BLACK]: 100_000,
};

export const DAILY_NGN_LIMIT: Record<Tier, number> = {
  [Tier.SILVER]: 200_000,
  [Tier.GOLD]: 1_000_000,
  [Tier.BLACK]: 10_000_000,
};

export const CARD_SPEND_LIMIT_USDC: Record<Tier, number | null> = {
  [Tier.SILVER]: null, // no card on Silver
  [Tier.GOLD]:   500,
  [Tier.BLACK]:  null, // no card on Black
};

// ─────────────────────────────────────────────────────────────────────────────
// Lifetime milestones that unlock the next tier
// ─────────────────────────────────────────────────────────────────────────────

export const TIER_MILESTONES = {
  // Silver → Gold: $20k lifetime outbound OR 500 outbound transactions
  silverToGold: {
    volumeUsdc: 20_000,
    txCount: 500,
  },
  // Gold → Black: $100k lifetime outbound OR 1,000 outbound transactions
  goldToBlack: {
    volumeUsdc: 100_000,
    txCount: 1_000,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatCryptoLimit(tier: Tier): string {
  return `$${DAILY_CRYPTO_LIMIT_USDC[tier].toLocaleString()} USDC`;
}

export function formatNgnLimit(tier: Tier): string {
  return `₦${DAILY_NGN_LIMIT[tier].toLocaleString()}`;
}
