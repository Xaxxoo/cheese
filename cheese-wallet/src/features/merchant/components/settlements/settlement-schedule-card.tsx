'use client';

import { useState } from 'react';
import { CalendarClock, Landmark, Wallet } from 'lucide-react';
import type { PayoutAccount, PayoutSchedule, SettlementMode } from '../../types';
import { MerchantButton, SectionCard } from '../shared/primitives';
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
      description="Tune how confirmed payments convert into merchant balance or bank payout."
    >
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {/* Mode selection cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {([
              {
                value: 'instant_fiat' as SettlementMode,
                icon: Landmark,
                label: 'Instant fiat',
                description: 'Convert and push to your bank the moment each payment clears.',
              },
              {
                value: 'hold_usdc' as SettlementMode,
                icon: Wallet,
                label: 'Hold digital dollar',
                description: 'Keep cleared value as digital dollars for treasury operations.',
              },
            ]).map(({ value, icon: Icon, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSettlementMode(value)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all duration-150',
                  settlementMode === value
                    ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                    : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    settlementMode === value
                      ? 'text-[color:var(--merchant-action-fg)]/70'
                      : 'text-[color:var(--merchant-muted)]',
                  )}
                />
                <h3 className="mt-3 text-sm font-semibold">{label}</h3>
                <p
                  className={cn(
                    'mt-1 text-xs leading-5',
                    settlementMode === value
                      ? 'text-[color:var(--merchant-action-fg)]/60'
                      : 'text-[color:var(--merchant-muted)]',
                  )}
                >
                  {description}
                </p>
              </button>
            ))}
          </div>

          {/* Schedule */}
          <div className="rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-4">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-4 w-4 text-[#D4A843] flex-shrink-0" />
              <div>
                <h3 className="text-xs font-semibold text-[color:var(--merchant-text)]">Payout schedule</h3>
                <p className="text-xs text-[color:var(--merchant-muted)]">
                  How often CheesePay flushes confirmed payout-ready volume.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['instant', 'daily', 'weekly'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSchedule(option)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-all duration-150',
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
        </div>

        {/* Policy summary panel */}
        <div className="space-y-4 rounded-xl bg-[color:var(--merchant-action-bg)] p-5 text-[color:var(--merchant-action-fg)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--merchant-action-fg)]/45">
              Current payout policy
            </p>
            <h3 className="mt-2.5 text-xl font-semibold tracking-[-0.03em]">
              {settlementMode === 'instant_fiat' ? 'Fastest local payout' : 'Treasury-first hold'}
            </h3>
          </div>

          <div className="space-y-2.5 rounded-xl bg-[color:var(--merchant-action-fg)]/8 p-4 text-sm">
            {[
              { label: 'Quoted FX rate', value: currentRate },
              { label: 'Schedule', value: schedule },
              { label: 'Estimated arrival', value: arrivalNote },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[color:var(--merchant-action-fg)]/60">{label}</span>
                <span className="font-medium capitalize text-[color:var(--merchant-action-fg)]">{value}</span>
              </div>
            ))}
          </div>

          {payoutAccounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-[color:var(--merchant-action-fg)]/10 bg-[color:var(--merchant-action-fg)]/6 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{account.label}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--merchant-action-fg)]/55">{account.destination}</p>
                </div>
                <span className="rounded-full bg-[color:var(--merchant-action-fg)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--merchant-action-fg)]/70">
                  {account.currency}
                </span>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="w-full rounded-lg bg-[color:var(--merchant-action-fg)] py-2 text-sm font-medium text-[color:var(--merchant-action-bg)] transition-opacity hover:opacity-90"
          >
            Save settlement policy
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
