'use client';

import { useState } from 'react';
import { CalendarClock, Landmark, Wallet } from 'lucide-react';
import type { PayoutAccount, PayoutSchedule, SettlementMode } from '../../types';
import { SectionCard } from '../shared/primitives';
import { cn } from '@/lib/cn';

export function SettlementScheduleCard({
  payoutAccounts = [],
  currentRate = '—',
  arrivalNote = '~15 seconds',
  currentMode = 'instant_fiat',
  currentSchedule = 'instant',
}: {
  payoutAccounts?: PayoutAccount[];
  currentRate?: string;
  arrivalNote?: string;
  currentMode?: SettlementMode;
  currentSchedule?: PayoutSchedule;
}) {
  const [settlementMode, setSettlementMode] = useState<SettlementMode>(currentMode);
  const [schedule, setSchedule] = useState<PayoutSchedule>(currentSchedule);

  return (
    <SectionCard
      title="Settlement engine"
      description="Tune how confirmed payments convert into balance or bank payout."
    >
      <div className="space-y-4">
        {/* Mode selection */}
        <div className="space-y-2">
          {([
            {
              value: 'instant_fiat' as SettlementMode,
              icon: Landmark,
              label: 'Instant fiat',
              description: 'Convert and push to your bank when each payment clears.',
            },
            {
              value: 'hold_usdc' as SettlementMode,
              icon: Wallet,
              label: 'Hold digital dollar',
              description: 'Keep cleared value as digital dollars for treasury use.',
            },
          ]).map(({ value, icon: Icon, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSettlementMode(value)}
              className={cn(
                'w-full rounded-xl border p-3.5 text-left transition-all duration-150 flex items-start gap-3',
                settlementMode === value
                  ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                  : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 mt-0.5 flex-shrink-0',
                  settlementMode === value
                    ? 'text-[color:var(--merchant-action-fg)]/70'
                    : 'text-[color:var(--merchant-muted)]',
                )}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{label}</p>
                <p
                  className={cn(
                    'mt-0.5 text-[11px] leading-4',
                    settlementMode === value
                      ? 'text-[color:var(--merchant-action-fg)]/60'
                      : 'text-[color:var(--merchant-muted)]',
                  )}
                >
                  {description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Schedule */}
        <div className="rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-3.5 w-3.5 text-[#D4A843] flex-shrink-0" />
            <p className="text-xs font-semibold text-[color:var(--merchant-text)]">Payout schedule</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['instant', 'daily', 'weekly'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSchedule(option)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-all duration-150',
                  schedule === option
                    ? 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                    : 'border border-[color:var(--merchant-border)] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)]',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Policy summary */}
        <div className="rounded-xl bg-[color:var(--merchant-action-bg)] p-4 text-[color:var(--merchant-action-fg)]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--merchant-action-fg)]/45 mb-3">
            Current policy
          </p>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Mode', value: settlementMode === 'instant_fiat' ? 'Instant fiat' : 'Hold digital dollar' },
              { label: 'Schedule', value: schedule },
              { label: 'FX rate', value: currentRate },
              { label: 'Est. arrival', value: arrivalNote },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[color:var(--merchant-action-fg)]/55">{label}</span>
                <span className="font-medium capitalize">{value}</span>
              </div>
            ))}
          </div>

          {payoutAccounts.map((account) => (
            <div
              key={account.id}
              className="mt-3 rounded-lg border border-[color:var(--merchant-action-fg)]/10 bg-[color:var(--merchant-action-fg)]/6 px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold truncate">{account.label}</p>
                <span className="text-[10px] font-semibold uppercase text-[color:var(--merchant-action-fg)]/60 flex-shrink-0">
                  {account.currency}
                </span>
              </div>
              <p className="text-[11px] text-[color:var(--merchant-action-fg)]/50 mt-0.5 truncate">{account.destination}</p>
            </div>
          ))}

          <button
            type="button"
            className="mt-4 w-full rounded-lg bg-[color:var(--merchant-action-fg)] py-2 text-xs font-medium text-[color:var(--merchant-action-bg)] transition-opacity hover:opacity-90"
          >
            Save settlement policy
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
