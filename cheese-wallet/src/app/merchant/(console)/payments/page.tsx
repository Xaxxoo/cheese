'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useMerchantPayments, merchantQueryKeys } from '@/features/merchant/hooks/use-merchant-data';
import { MerchantButton, SectionCard, EmptyState } from '@/features/merchant/components/shared/primitives';
import { StatusBadge } from '@/features/merchant/components/shared/status-badge';
import { PaymentRequestBuilder } from '@/features/merchant/components/payments/payment-request-builder';
import type { Payment } from '@/features/merchant/types';

const STATUS_TABS = ['all', 'pending', 'confirmed', 'settled', 'failed', 'expired'] as const;

function PaymentRow({ payment, onClick }: { payment: Payment; onClick: () => void }) {
  return (
    <tr
      className="group cursor-pointer hover:bg-[color:var(--merchant-panel)] transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm font-mono text-[color:var(--merchant-text)]">{payment.reference}</div>
        <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5 capitalize">
          {payment.requestKind.replace(/_/g, ' ')}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm text-[color:var(--merchant-text)]">{payment.customerName}</div>
        <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5">{payment.customerEmail}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <div className="text-sm font-medium text-[color:var(--merchant-text)]">{payment.fiatAmount}</div>
        <div className="text-xs text-[color:var(--merchant-muted)] mt-0.5">{payment.digitalDollarAmount}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right hidden md:table-cell">
        <div className="text-xs text-[color:var(--merchant-muted)]">{payment.network}</div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusBadge status={payment.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right text-xs text-[color:var(--merchant-muted)]">
        {new Date(payment.createdAt).toLocaleDateString('en', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
    </tr>
  );
}

export default function MerchantPaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showBuilder, setShowBuilder] = useState(false);
  const { data: payments, isLoading, isError } = useMerchantPayments();

  const paymentList: Payment[] = Array.isArray(payments) ? payments : [];
  const filtered = paymentList.filter(
    (p) => activeTab === 'all' || p.status === activeTab,
  );

  function handlePaymentCreated() {
    setShowBuilder(false);
    void queryClient.invalidateQueries({ queryKey: merchantQueryKeys.payments });
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
            Payments
          </h1>
          <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
            All payment requests across your stores.
          </p>
        </div>
        <MerchantButton
          variant="primary"
          onClick={() => setShowBuilder(true)}
          className="h-9 px-4"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 -ml-0.5">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New request
        </MerchantButton>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = tab === 'all'
            ? paymentList.length
            : paymentList.filter((p) => p.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-[color:var(--merchant-text)] text-[color:var(--merchant-bg)]'
                  : 'text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:bg-[color:var(--merchant-panel)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab
                    ? 'bg-[color:var(--merchant-bg)] text-[color:var(--merchant-text)]'
                    : 'bg-[color:var(--merchant-border)]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <SectionCard title="">
        {isError ? (
          <EmptyState
            title="Could not load payments"
            description="Try refreshing the page."
          />
        ) : isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex-1 h-10 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
                <div className="w-24 h-10 rounded-lg bg-[color:var(--merchant-border)] animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={activeTab === 'all' ? 'No payments yet' : `No ${activeTab} payments`}
            description={
              activeTab === 'all'
                ? 'Create a payment request to start collecting.'
                : 'No payments match this status filter.'
            }
            action={
              activeTab === 'all' ? (
                <MerchantButton variant="primary" onClick={() => setShowBuilder(true)} className="h-9 px-4">
                  Create payment request
                </MerchantButton>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[color:var(--merchant-border)]">
                  {['Reference', 'Customer', 'Amount', 'Network', 'Status', 'Date'].map((col, i) => (
                    <th
                      key={col}
                      className={`px-4 py-2.5 text-xs font-medium text-[color:var(--merchant-muted)] ${
                        i === 2 || i === 5 ? 'text-right' : ''
                      } ${i === 3 ? 'hidden md:table-cell text-right' : ''}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--merchant-border)]">
                {filtered.map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    onClick={() => router.push(`/merchant/payments/${p.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Payment builder drawer */}
      {showBuilder && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBuilder(false)}
          />
          <div className="w-full max-w-xl bg-[color:var(--merchant-bg)] border-l border-[color:var(--merchant-border)] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--merchant-border)]">
              <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">
                New payment request
              </h2>
              <button
                onClick={() => setShowBuilder(false)}
                className="p-1 rounded-lg text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:bg-[color:var(--merchant-panel)] transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-6">
              <PaymentRequestBuilder onCreated={handlePaymentCreated} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
