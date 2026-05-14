import { cn } from '@/lib/cn';
import { statusTone } from '../../lib/format';
import type { PaymentStatus, SettlementStatus } from '../../types';

const TONE_STYLES = {
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  blue:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  slate:   'bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-soft-text)] border-[color:var(--merchant-border)]',
  rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
} as const;

const DOT_STYLES = {
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  blue:    'bg-sky-400',
  slate:   'bg-[color:var(--merchant-muted)]',
  rose:    'bg-rose-400',
} as const;

export function StatusBadge({
  status,
}: {
  status: PaymentStatus | SettlementStatus;
}) {
  const tone = statusTone(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
        TONE_STYLES[tone],
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_STYLES[tone])} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
