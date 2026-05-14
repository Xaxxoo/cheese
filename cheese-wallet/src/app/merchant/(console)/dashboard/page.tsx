'use client';

import { useMerchantDashboard } from '@/features/merchant/hooks/use-merchant-data';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import { MetricCard, SectionCard, EmptyState } from '@/features/merchant/components/shared/primitives';
import { RevenueAreaChart, BreakdownDonutChart } from '@/features/merchant/components/charts/merchant-charts';
import type { RecentActivityItem } from '@/features/merchant/types';

function ActivityIcon({ type }: { type: RecentActivityItem['type'] }) {
  const icons = {
    payment: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
    ),
    settlement: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    ),
    risk: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    api: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    ),
  };
  const colors = {
    payment: 'text-violet-400 bg-violet-400/10',
    settlement: 'text-emerald-400 bg-emerald-400/10',
    risk: 'text-amber-400 bg-amber-400/10',
    api: 'text-sky-400 bg-sky-400/10',
  };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${colors[type]}`}>
      {icons[type]}
    </span>
  );
}

function timeAgo(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function MerchantDashboardPage() {
  const { data, isLoading, isError } = useMerchantDashboard();
  const session = useMerchantAuthStore((s) => s.session);
  const displayName = session?.merchant?.displayName ?? 'your store';

  if (isError) {
    return (
      <div className="p-8">
        <EmptyState
          title="Could not load dashboard"
          description="There was a problem fetching your data. Please refresh the page."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
          Here&apos;s what&apos;s happening with {displayName} today.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-[color:var(--merchant-panel)] animate-pulse border border-[color:var(--merchant-border)]"
              />
            ))
          : data?.summaries.map((s) => (
              <MetricCard key={s.label} label={s.label} amount={s.amount} trend={s.trend} tone={s.tone} />
            ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Revenue (7 days)" className="lg:col-span-2">
          {isLoading ? (
            <div className="h-52 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
          ) : data?.revenueSeries && data.revenueSeries.length > 0 ? (
            <RevenueAreaChart points={data.revenueSeries} />
          ) : (
            <EmptyState
              title="No revenue data yet"
              description="Revenue will appear here once your first payment is processed."
            />
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Payment networks">
            {isLoading ? (
              <div className="h-36 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
            ) : (
              <BreakdownDonutChart slices={data?.networkUsage ?? []} />
            )}
          </SectionCard>
          <SectionCard title="Settlement mix">
            {isLoading ? (
              <div className="h-36 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
            ) : (
              <BreakdownDonutChart slices={data?.settlementMix ?? []} />
            )}
          </SectionCard>
        </div>
      </div>

      {/* Activity feed */}
      <SectionCard title="Recent activity">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[color:var(--merchant-border)] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 rounded bg-[color:var(--merchant-border)] animate-pulse" />
                  <div className="h-3 w-64 rounded bg-[color:var(--merchant-border)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.recentActivity?.length ? (
          <EmptyState
            title="No activity yet"
            description="Your recent payments and settlements will appear here."
          />
        ) : (
          <div className="divide-y divide-[color:var(--merchant-border)]">
            {data.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <ActivityIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[color:var(--merchant-text)] truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-[color:var(--merchant-muted)] truncate mt-0.5">
                    {item.note}
                  </p>
                </div>
                <span className="text-xs text-[color:var(--merchant-muted)] flex-shrink-0 mt-0.5">
                  {timeAgo(item.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Stats row */}
      {!isLoading && data && (
        <div className="flex items-center gap-2 text-xs text-[color:var(--merchant-muted)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-400">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Average settlement speed: {data.averageSettlementSpeed}
        </div>
      )}
    </div>
  );
}
