import type { PaymentStatus, SettlementMode, SettlementStatus } from '../types';

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function statusTone(
  status: PaymentStatus | SettlementStatus,
): 'emerald' | 'amber' | 'blue' | 'slate' | 'rose' {
  switch (status) {
    case 'settled':
    case 'confirmed':
      return 'emerald';
    case 'settling':
    case 'awaiting_confirmation':
      return 'blue';
    case 'pending':
    case 'queued':
      return 'slate';
    case 'expired':
      return 'amber';
    case 'failed':
      return 'rose';
  }
}

export function settlementModeLabel(mode: SettlementMode) {
  return mode === 'instant_fiat' ? 'Instant payout' : 'Hold digital dollar';
}
