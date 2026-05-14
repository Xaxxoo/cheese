'use client';

import { useMerchantSettlements } from '@/features/merchant/hooks/use-merchant-data';
import { MetricCard, SectionCard, EmptyState } from '@/features/merchant/components/shared/primitives';
import { StatusBadge } from '@/features/merchant/components/shared/status-badge';
import { SettlementScheduleCard } from '@/features/merchant/components/settlements/settlement-schedule-card';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

function PayoutAccountBadge({ status }: { status: 'active' | 'review' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
      status === 'active'
        ? 'bg-emerald-400/10 text-emerald-400'
        : 'bg-amber-400/10 text-amber-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {status === 'active' ? 'Active' : 'Under review'}
    </span>
  );
}

export default function MerchantSettlementsPage() {
  const { data, isLoading, isError } = useMerchantSettlements();
  const session = useMerchantAuthStore((s) => s.session);

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
          Settlements
        </h1>
        <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
          Payout history and account configuration.
        </p>
      </div>

      {/* Summary metrics */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-[color:var(--merchant-panel)] animate-pulse border border-[color:var(--merchant-border)]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {data?.summaries.map((s) => (
            <MetricCard key={s.label} label={s.label} amount={s.amount} trend={s.trend} tone={s.tone} />
          ))}
        </div>
      )}

      {/* FX rate callout */}
      {!isLoading && data && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-violet-400 flex-shrink-0">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">
            <span className="text-[color:var(--merchant-muted)]">Live rate: </span>
            <span className="font-medium text-[color:var(--merchant-text)]">{data.currentFxRate}</span>
            <span className="text-[color:var(--merchant-muted)] ml-3">{data.estimatedArrival}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: settlement history */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Payout history">
            {isError ? (
              <EmptyState
                title="Could not load settlements"
                description="Try refreshing the page."
              />
            ) : isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
                ))}
              </div>
            ) : !data?.settlements.length ? (
              <EmptyState
                title="No payouts yet"
                description="Settlements will appear here once payments are confirmed and settled."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[color:var(--merchant-border)]">
                      {['Reference', 'Amount', 'Destination', 'Schedule', 'Status', 'Date'].map((col, i) => (
                        <th
                          key={col}
                          className={`px-4 py-2.5 text-xs font-medium text-[color:var(--merchant-muted)] ${
                            i === 1 ? 'text-right' : ''
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--merchant-border)]">
                    {data.settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-[color:var(--merchant-panel)] transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-mono text-[color:var(--merchant-text)]">
                            {s.paymentReference}
                          </div>
                          {s.bankReference && s.bankReference !== '—' && (
                            <div className="text-[10px] text-[color:var(--merchant-muted)] mt-0.5 font-mono">
                              Bank: {s.bankReference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-[color:var(--merchant-text)]">{s.netAmount}</div>
                          <div className="text-xs text-[color:var(--merchant-muted)]">{s.grossAmount} gross</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs text-[color:var(--merchant-text)] max-w-[160px] truncate">{s.destination}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs capitalize text-[color:var(--merchant-muted)]">{s.schedule}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-[color:var(--merchant-muted)]">
                          {new Date(s.createdAt).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: payout accounts + settings */}
        <div className="space-y-6">
          <SectionCard title="Payout accounts">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
                ))}
              </div>
            ) : !data?.payoutAccounts.length ? (
              <div className="py-4 text-center">
                <p className="text-xs text-[color:var(--merchant-muted)]">No payout accounts configured.</p>
                <p className="text-xs text-[color:var(--merchant-muted)] mt-1">Contact support to add a bank account.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.payoutAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[color:var(--merchant-text)] truncate">
                          {account.label}
                        </span>
                        {account.defaultForInstantPayout && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-400/10 text-violet-400 flex-shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5 capitalize">
                        {account.accountType.replace(/_/g, ' ')} · {account.currency}
                      </div>
                      <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5 truncate font-mono">
                        {account.destination}
                      </div>
                    </div>
                    <PayoutAccountBadge status={account.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Settlement schedule config */}
          <SettlementScheduleCard
            currentMode={session?.merchant?.defaultSettlementMode ?? 'instant_fiat'}
            currentSchedule={session?.merchant?.payoutSchedule ?? 'instant'}
          />
        </div>
      </div>
    </div>
  );
}
