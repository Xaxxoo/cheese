'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMerchantPayment } from '@/features/merchant/hooks/use-merchant-data';
import { MerchantButton, SectionCard } from '@/features/merchant/components/shared/primitives';
import { StatusBadge } from '@/features/merchant/components/shared/status-badge';
import type { PaymentTimelineEvent } from '@/features/merchant/types';

function TimelineStep({ event }: { event: PaymentTimelineEvent }) {
  const colors = {
    done: 'bg-emerald-400 border-emerald-400',
    current: 'bg-violet-400 border-violet-400',
    upcoming: 'bg-transparent border-[color:var(--merchant-border)]',
    failed: 'bg-rose-400 border-rose-400',
  };
  const textColors = {
    done: 'text-[color:var(--merchant-text)]',
    current: 'text-[color:var(--merchant-text)] font-medium',
    upcoming: 'text-[color:var(--merchant-muted)]',
    failed: 'text-rose-400',
  };

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${colors[event.status]}`} />
        <div className="flex-1 w-px bg-[color:var(--merchant-border)] mt-2" />
      </div>
      <div className="pb-6 flex-1">
        <div className={`text-sm ${textColors[event.status]}`}>{event.label}</div>
        <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5">{event.description}</div>
        <div className="text-[10px] text-[color:var(--merchant-muted)] mt-1 font-mono">
          {new Date(event.at).toLocaleString('en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[color:var(--merchant-border)] last:border-0">
      <span className="text-xs text-[color:var(--merchant-muted)] flex-shrink-0">{label}</span>
      <span className="text-sm text-[color:var(--merchant-text)] text-right break-all">{value}</span>
    </div>
  );
}

export default function MerchantPaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useMerchantPayment(paymentId);

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-72 rounded-xl bg-[color:var(--merchant-panel)] animate-pulse border border-[color:var(--merchant-border)]" />
          <div className="h-72 rounded-xl bg-[color:var(--merchant-panel)] animate-pulse border border-[color:var(--merchant-border)]" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 md:p-8">
        <MerchantButton variant="ghost" onClick={() => router.back()} className="mb-6 h-9">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </MerchantButton>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center">
          <p className="text-sm text-rose-400">Payment not found or could not be loaded.</p>
        </div>
      </div>
    );
  }

  const { payment, timeline, feeSummary } = data;

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Back + header */}
      <div>
        <MerchantButton variant="ghost" onClick={() => router.back()} className="mb-4 h-9 -ml-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          All payments
        </MerchantButton>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)] font-mono">
                {payment.reference}
              </h1>
              <StatusBadge status={payment.status} />
            </div>
            <p className="text-sm text-[color:var(--merchant-muted)]">
              {new Date(payment.createdAt).toLocaleString('en', {
                weekday: 'short',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-[color:var(--merchant-text)]">
              {payment.fiatAmount}
            </div>
            <div className="text-sm text-[color:var(--merchant-muted)]">
              {payment.digitalDollarAmount} USDC
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details + fees */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Payment details">
            <DetailRow label="Customer" value={payment.customerName} />
            <DetailRow label="Email" value={payment.customerEmail} />
            <DetailRow label="Store" value={payment.storeName} />
            <DetailRow label="Kind" value={
              <span className="capitalize">{payment.requestKind.replace(/_/g, ' ')}</span>
            } />
            <DetailRow label="Network" value={payment.network} />
            <DetailRow label="Settlement" value={
              <span className="capitalize">{payment.settlementMode.replace(/_/g, ' ')}</span>
            } />
            <DetailRow label="Settlement currency" value={payment.settlementCurrency} />
            {payment.callbackUrl && (
              <DetailRow
                label="Callback URL"
                value={
                  <a
                    href={payment.callbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:underline break-all"
                  >
                    {payment.callbackUrl}
                  </a>
                }
              />
            )}
            {payment.expiresAt && (
              <DetailRow
                label="Expires"
                value={new Date(payment.expiresAt).toLocaleString('en')}
              />
            )}
          </SectionCard>

          <SectionCard title="Fee summary">
            <DetailRow label="Processing fee" value={feeSummary.processingFee} />
            <DetailRow label="Settlement fee" value={feeSummary.settlementFee} />
            <DetailRow label="FX rate" value={feeSummary.fxRate} />
            <DetailRow label="Payout ETA" value={feeSummary.payoutEta} />
          </SectionCard>

          {/* Metadata */}
          {payment.metadata && Object.keys(payment.metadata).length > 0 && (
            <SectionCard title="Metadata">
              {Object.entries(payment.metadata).map(([k, v]) => (
                <DetailRow key={k} label={k} value={String(v)} />
              ))}
            </SectionCard>
          )}
        </div>

        {/* Right: timeline */}
        <SectionCard title="Timeline">
          {timeline.length === 0 ? (
            <p className="text-sm text-[color:var(--merchant-muted)]">No events yet.</p>
          ) : (
            <div className="mt-2">
              {timeline.map((event) => (
                <TimelineStep key={event.id} event={event} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
