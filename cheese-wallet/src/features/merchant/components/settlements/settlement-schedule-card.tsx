'use client';

import { useState } from 'react';
import { CalendarClock, Landmark, Wallet } from 'lucide-react';
import type { PayoutAccount, PayoutSchedule, SettlementMode } from '../../types';
import { MerchantButton, SectionCard } from '../shared/primitives';

export function SettlementScheduleCard({
  payoutAccounts,
  currentRate,
  arrivalNote,
}: {
  payoutAccounts: PayoutAccount[];
  currentRate: string;
  arrivalNote: string;
}) {
  const [settlementMode, setSettlementMode] =
    useState<SettlementMode>('instant_fiat');
  const [schedule, setSchedule] = useState<PayoutSchedule>('daily');

  return (
    <SectionCard
      title="Settlement engine"
      description="Tune how confirmed payments convert into merchant balance or bank payout. The settlement engine hides network routing while exposing timing, fees, and destination controls."
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSettlementMode('instant_fiat')}
              className={`rounded-[24px] border p-5 text-left transition ${
                settlementMode === 'instant_fiat'
                  ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
                  : 'border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-text)]'
              }`}
            >
              <Landmark className="h-5 w-5" />
              <h3 className="mt-5 text-lg font-semibold">Instant fiat settlement</h3>
              <p className="mt-2 text-sm leading-6 opacity-80">
                Convert customer payments into local payout currency and release them to your bank destination as soon as the payment clears.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSettlementMode('hold_usdc')}
              className={`rounded-[24px] border p-5 text-left transition ${
                settlementMode === 'hold_usdc'
                  ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
                  : 'border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-text)]'
              }`}
            >
              <Wallet className="h-5 w-5" />
              <h3 className="mt-5 text-lg font-semibold">Hold digital dollar</h3>
              <p className="mt-2 text-sm leading-6 opacity-80">
                Keep cleared value in your merchant digital dollar balance for treasury operations, supplier payments, or cross-border payouts.
              </p>
            </button>
          </div>

          <div className="rounded-[24px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-5">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-[#1d4ed8]" />
              <div>
                <h3 className="text-base font-semibold text-[color:var(--merchant-text)]">
                  Payout schedule
                </h3>
                <p className="text-sm text-[color:var(--merchant-muted)]">
                  Choose how often CheesePay flushes confirmed payout-ready volume.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {(['instant', 'daily', 'weekly'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSchedule(option)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    schedule === option
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-[color:var(--merchant-panel)] text-[color:var(--merchant-muted)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-[28px] bg-[#0f172a] p-6 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
              Current payout policy
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              {settlementMode === 'instant_fiat'
                ? 'Fastest local payout'
                : 'Treasury-first balance hold'}
            </h3>
          </div>

          <div className="space-y-3 rounded-[24px] bg-white/8 p-4 text-sm text-white/78">
            <div className="flex items-center justify-between">
              <span>Quoted FX rate</span>
              <span className="font-semibold">{currentRate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Schedule</span>
              <span className="font-semibold capitalize">{schedule}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated arrival</span>
              <span className="font-semibold">{arrivalNote}</span>
            </div>
          </div>

          <div className="space-y-3">
            {payoutAccounts.map((account) => (
              <div
                key={account.id}
                className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{account.label}</p>
                    <p className="mt-1 text-xs text-white/58">{account.destination}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                    {account.currency}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <MerchantButton className="w-full bg-white text-[#0f172a] hover:bg-white/92">
            Save settlement policy
          </MerchantButton>
        </div>
      </div>
    </SectionCard>
  );
}
