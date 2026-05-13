'use client';

import { useState } from 'react';
import { Copy, Link2, QrCode, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';
import { previewPaymentRequest } from '../../lib/merchant-api';
import type { PaymentRequestDraft, PaymentRequestPreview } from '../../types';
import { MerchantButton, MerchantInput, SectionCard } from '../shared/primitives';
import { settlementModeLabel } from '../../lib/format';

const defaultDraft: PaymentRequestDraft = {
  kind: 'checkout_session',
  fiatAmount: '250000',
  fiatCurrency: 'NGN',
  customerName: 'Kora Wholesale',
  customerEmail: 'ap@korawholesale.com',
  settlementMode: 'instant_fiat',
  settlementCurrency: 'NGN',
  expirationMinutes: 45,
  callbackUrl: 'https://merchant.example.com/webhooks/cheesepay',
  metadata: '{"orderId":"ORD-2201"}',
};

export function PaymentRequestBuilder() {
  const [draft, setDraft] = useState<PaymentRequestDraft>(defaultDraft);
  const [preview, setPreview] = useState<PaymentRequestPreview | null>(null);
  const [building, setBuilding] = useState(false);

  async function buildPreview() {
    setBuilding(true);
    try {
      const nextPreview = await previewPaymentRequest(draft);
      setPreview(nextPreview);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not build payment request');
    } finally {
      setBuilding(false);
    }
  }

  function updateDraft<Key extends keyof PaymentRequestDraft>(
    key: Key,
    value: PaymentRequestDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard
        title="Create a payment request"
        description="Issue a merchant-ready checkout session, payment link, invoice, or QR-backed request without exposing blockchain complexity to staff or customers."
        action={
          <div className="rounded-full bg-[color:var(--merchant-panel-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--merchant-muted)]">
            Sandbox-safe preview
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
              Request type
            </span>
            <select
              value={draft.kind}
              onChange={(event) => updateDraft('kind', event.target.value as PaymentRequestDraft['kind'])}
              className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
            >
              <option value="checkout_session">Checkout session</option>
              <option value="payment_link">Payment link</option>
              <option value="invoice">Invoice</option>
              <option value="qr_dynamic">Dynamic QR</option>
              <option value="qr_static">Static QR</option>
              <option value="api_request">API request</option>
            </select>
          </label>

          <MerchantInput
            label="Settlement method"
            value={settlementModeLabel(draft.settlementMode)}
            readOnly
            suffix={draft.settlementCurrency}
          />

          <MerchantInput
            label="Fiat amount"
            value={draft.fiatAmount}
            onChange={(event) => updateDraft('fiatAmount', event.target.value)}
            placeholder="250000"
          />

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
              Customer currency
            </span>
            <select
              value={draft.fiatCurrency}
              onChange={(event) => {
                updateDraft('fiatCurrency', event.target.value);
                if (draft.settlementMode === 'instant_fiat') {
                  updateDraft('settlementCurrency', event.target.value);
                }
              }}
              className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <MerchantInput
            label="Customer name"
            value={draft.customerName}
            onChange={(event) => updateDraft('customerName', event.target.value)}
          />

          <MerchantInput
            label="Customer email"
            type="email"
            value={draft.customerEmail}
            onChange={(event) => updateDraft('customerEmail', event.target.value)}
          />

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
              Settlement mode
            </span>
            <select
              value={draft.settlementMode}
              onChange={(event) =>
                updateDraft(
                  'settlementMode',
                  event.target.value as PaymentRequestDraft['settlementMode'],
                )
              }
              className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
            >
              <option value="instant_fiat">Instant fiat settlement</option>
              <option value="hold_usdc">Hold as digital dollar</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
              Settlement currency
            </span>
            <select
              value={draft.settlementCurrency}
              onChange={(event) => updateDraft('settlementCurrency', event.target.value)}
              className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <MerchantInput
            label="Expiry window (minutes)"
            value={String(draft.expirationMinutes)}
            onChange={(event) =>
              updateDraft('expirationMinutes', Number(event.target.value || 0))
            }
          />

          <div className="md:col-span-2">
            <MerchantInput
              label="Callback URL"
              value={draft.callbackUrl}
              onChange={(event) => updateDraft('callbackUrl', event.target.value)}
            />
          </div>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
              Metadata
            </span>
            <textarea
              rows={4}
              value={draft.metadata}
              onChange={(event) => updateDraft('metadata', event.target.value)}
              className="rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 py-3 text-sm text-[color:var(--merchant-text)] outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <MerchantButton onClick={buildPreview} loading={building}>
            Build preview
          </MerchantButton>
          <MerchantButton
            variant="secondary"
            onClick={() => {
              setDraft(defaultDraft);
              setPreview(null);
            }}
          >
            Reset
          </MerchantButton>
        </div>
      </SectionCard>

      <SectionCard
        title="Checkout preview"
        description="This preview represents the merchant-facing payment artifact that will be exposed as hosted checkout, payment link, invoice, or QR-backed collection."
      >
        {preview ? (
          <div className="space-y-5">
            <div className="rounded-[28px] bg-[#0f172a] p-5 text-white shadow-[0_28px_100px_rgba(15,23,42,0.18)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                    {draft.kind.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
                    {draft.fiatCurrency} {draft.fiatAmount}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    Quoted as {preview.quotedDigitalDollarAmount}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                    Reference
                  </p>
                  <p className="mt-1 text-sm font-semibold">{preview.reference}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 rounded-[24px] bg-white/8 p-4 text-sm text-white/78">
                <div className="flex items-center justify-between">
                  <span>Settlement</span>
                  <span className="font-medium">{preview.settlementDescription}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Expires</span>
                  <span className="font-medium">{preview.expiresLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Customer</span>
                  <span className="font-medium">{draft.customerName}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Hosted checkout',
                  value: preview.checkoutUrl,
                  icon: Link2,
                },
                {
                  title: 'Invoice artifact',
                  value: `Receipt bundle for ${preview.reference}`,
                  icon: ReceiptText,
                },
                {
                  title: 'QR asset',
                  value: 'Served by backend QR endpoint',
                  icon: QrCode,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-4"
                >
                  <item.icon className="h-4 w-4 text-[#1d4ed8]" />
                  <p className="mt-4 text-sm font-semibold text-[color:var(--merchant-text)]">
                    {item.title}
                  </p>
                  <p className="mt-2 break-all text-xs leading-5 text-[color:var(--merchant-muted)]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <MerchantButton
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(preview.checkoutUrl);
                toast.success('Checkout URL copied');
              }}
              className="w-full"
            >
              <Copy className="h-4 w-4" />
              Copy checkout URL
            </MerchantButton>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-8 text-center">
            <h3 className="text-lg font-semibold text-[color:var(--merchant-text)]">
              Build a live preview
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
              Generate a merchant-ready payment artifact to inspect amounts, settlement behavior, and hosted checkout shape before you issue it live.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
