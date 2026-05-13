import { cn } from '@/lib/cn';
import { statusTone } from '../../lib/format';
import type { PaymentStatus, SettlementStatus } from '../../types';

export function StatusBadge({
  status,
}: {
  status: PaymentStatus | SettlementStatus;
}) {
  const tone = statusTone(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize',
        tone === 'emerald' && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
        tone === 'amber' && 'bg-amber-500/14 text-amber-700 dark:text-amber-200',
        tone === 'blue' && 'bg-sky-500/12 text-sky-700 dark:text-sky-200',
        tone === 'slate' && 'bg-slate-900/8 text-slate-600 dark:bg-slate-100/8 dark:text-slate-300',
        tone === 'rose' && 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
