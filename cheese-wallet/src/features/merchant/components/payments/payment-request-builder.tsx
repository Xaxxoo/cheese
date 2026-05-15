'use client';

import { useState } from 'react';
import { Copy, Link2, QrCode, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';
import { previewPaymentRequest, createMerchantPayment } from '../../lib/merchant-api';
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

interface PaymentRequestBuilderProps {
  onCreated?: () => void;
}

const SELECT_CLS =
  'h-9 w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 text-sm text-[color:var(--merchant-text)] outline-none transition-colors focus:border-[color:var(--merchant-strong-border)] focus:bg-[color:var(--merchant-panel-strong)]';

export function PaymentRequestBuilder({ onCreated }: PaymentRequestBuilderProps = {}) {
  const [draft, setDraft] = useState<PaymentRequestDraft>(defaultDraft);
  const [preview, setPreview] = useState<PaymentRequestPreview | null>(null);
  const [building, setBuilding] = useState(false);
  const [creating, setCreating] = useState(false);

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

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createMerchantPayment(draft);
      toast.success(`Payment created: ${result.reference}`);
      setDraft(defaultDraft);
      setPreview(null);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create payment request');
    } finally {
      setCreating(false);
    }
  }

  function updateDraft<Key extends keyof PaymentRequestDraft>(
    key: Key,
    value: PaymentRequestDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Create a payment request"
        description="Issue a checkout session, payment link, invoice, or QR-backed request without exposing blockchain complexity."
        action={
          <span className="rounded-full border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--merchant-muted)]">
            Sandbox preview
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Request type</span>
            <select
              value={draft.kind}
              onChange={(event) => updateDraft('kind', event.target.value as PaymentRequestDraft['kind'])}
              className={SELECT_CLS}
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Customer currency</span>
            <select
              value={draft.fiatCurrency}
              onChange={(event) => {
                updateDraft('fiatCurrency', event.target.value);
                if (draft.settlementMode === 'instant_fiat') {
                  updateDraft('settlementCurrency', event.target.value);
                }
              }}
              className={SELECT_CLS}
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

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Settlement mode</span>
            <select
              value={draft.settlementMode}
              onChange={(event) =>
                updateDraft('settlementMode', event.target.value as PaymentRequestDraft['settlementMode'])
              }
              className={SELECT_CLS}
            >
              <option value="instant_fiat">Instant fiat settlement</option>
              <option value="hold_usdc">Hold as digital dollar</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Settlement currency</span>
            <select
              value={draft.settlementCurrency}
              onChange={(event) => updateDraft('settlementCurrency', event.target.value)}
              className={SELECT_CLS}
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
            onChange={(event) => updateDraft('expirationMinutes', Number(event.target.value || 0))}
          />

          <div className="md:col-span-2">
            <MerchantInput
              label="Callback URL"
              value={draft.callbackUrl}
              onChange={(event) => updateDraft('callbackUrl', event.target.value)}
            />
          </div>

          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Metadata (JSON)</span>
            <textarea
              rows={3}
              value={draft.metadata}
              onChange={(event) => updateDraft('metadata', event.target.value)}
              className="w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3.5 py-2.5 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] outline-none transition-colors focus:border-[color:var(--merchant-strong-border)] focus:bg-[color:var(--merchant-panel-strong)] resize-none font-mono"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <MerchantButton onClick={buildPreview} loading={building}>
            Build preview
          </MerchantButton>
          {preview && (
            <MerchantButton variant="primary" onClick={handleCreate} loading={creating}>
              Create payment
            </MerchantButton>
          )}
          <MerchantButton
            variant="ghost"
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
        description="Inspect amounts, settlement behavior, and checkout shape before issuing live."
      >
        {preview ? (
          <div className="space-y-5">
            {/* Preview card */}
            <div className="rounded-xl bg-[color:var(--merchant-action-bg)] p-5 text-[color:var(--merchant-action-fg)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--merchant-action-fg)]/50">
                    {draft.kind.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-3 font-merchant-serif text-3xl font-semibold tracking-tight text-[color:var(--merchant-action-fg)]">
                    {draft.fiatCurrency} {draft.fiatAmount}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--merchant-action-fg)]/60">
                    Quoted as {preview.quotedDigitalDollarAmount}
                  </p>
                </div>
                <div className="rounded-lg bg-[color:var(--merchant-action-fg)]/10 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--merchant-action-fg)]/45">Ref</p>
                  <p className="mt-1 text-xs font-semibold font-mono">{preview.reference}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 rounded-xl bg-[color:var(--merchant-action-fg)]/8 p-4 text-sm">
                {[
                  { label: 'Settlement', value: preview.settlementDescription },
                  { label: 'Expires', value: preview.expiresLabel },
                  { label: 'Customer', value: draft.customerName },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[color:var(--merchant-action-fg)]/60">{label}</span>
                    <span className="font-medium text-[color:var(--merchant-action-fg)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Artifact cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Hosted checkout', value: preview.checkoutUrl, icon: Link2 },
                { title: 'Invoice artifact', value: `Receipt bundle for ${preview.reference}`, icon: ReceiptText },
                { title: 'QR asset', value: 'Served by backend QR endpoint', icon: QrCode },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-4"
                >
                  <item.icon className="h-4 w-4 text-[#D4A843]" />
                  <p className="mt-3 text-xs font-semibold text-[color:var(--merchant-text)]">{item.title}</p>
                  <p className="mt-1 break-all text-[11px] leading-5 text-[color:var(--merchant-muted)]">{item.value}</p>
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
              <Copy className="h-3.5 w-3.5" />
              Copy checkout URL
            </MerchantButton>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--merchant-border)] text-[#D4A843]">
              <ReceiptText className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-[color:var(--merchant-text)]">Build a live preview</h3>
            <p className="mt-2 max-w-xs mx-auto text-xs leading-5 text-[color:var(--merchant-muted)]">
              Fill in the request details and click "Build preview" to inspect the payment artifact before issuing it.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
