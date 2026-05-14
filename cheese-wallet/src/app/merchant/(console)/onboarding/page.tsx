'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import { completeMerchantOnboarding } from '@/features/merchant/lib/merchant-api';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import type { SettlementMode, PayoutSchedule, MerchantType } from '@/features/merchant/types';
import { cn } from '@/lib/cn';

const MERCHANT_TYPES: { value: MerchantType; label: string; description: string }[] = [
  { value: 'individual', label: 'Individual / Sole trader', description: 'You operate as a freelancer or individual seller.' },
  { value: 'business', label: 'Registered business', description: 'You have a registered business entity (Ltd, Inc, LLC, etc.).' },
];

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR'];
const COUNTRIES = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'Germany', 'France'];

const SETTLEMENT_MODES: { value: SettlementMode; label: string; description: string }[] = [
  { value: 'instant_fiat', label: 'Instant fiat payout', description: 'Convert payments to local currency and send to your bank as soon as they confirm.' },
  { value: 'hold_usdc', label: 'Hold digital dollars', description: 'Keep cleared value in your digital dollar merchant balance for treasury use.' },
];

const SCHEDULES: { value: PayoutSchedule; label: string; description: string }[] = [
  { value: 'instant', label: 'Instant', description: 'Flush settled balance as each payment clears.' },
  { value: 'daily', label: 'Daily', description: 'Batch payouts once per day at 17:00 UTC.' },
  { value: 'weekly', label: 'Weekly', description: 'Batch payouts every Monday at 17:00 UTC.' },
];

function StepDot({ active, done, step }: { active: boolean; done: boolean; step: number }) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-150',
        done && 'bg-emerald-500 text-white',
        active && !done && 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]',
        !active && !done && 'bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-muted)]',
      )}
    >
      {done ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        step
      )}
    </div>
  );
}

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const session            = useMerchantAuthStore((s) => s.session);
  const completeOnboarding = useMerchantAuthStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    merchantType: 'business' as MerchantType,
    country: session?.merchant.country ?? 'Nigeria',
    baseCurrency: session?.merchant.baseCurrency ?? 'NGN',
    settlementMode: (session?.merchant.defaultSettlementMode ?? 'instant_fiat') as SettlementMode,
    payoutSchedule: (session?.merchant.payoutSchedule ?? 'instant') as PayoutSchedule,
    storeName: session?.merchant.displayName ?? '',
  });

  const alreadyComplete = session?.onboardingComplete ?? false;

  async function handleFinish() {
    setError(null);
    setSaving(true);
    try {
      const patch = await completeMerchantOnboarding(form);
      completeOnboarding({ ...patch, onboardingComplete: true });
      router.replace('/merchant/dashboard');
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const steps = ['Business type', 'Location & currency', 'Settlement', 'Store'];

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
          {alreadyComplete ? 'Update account settings' : 'Set up your merchant account'}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
          {alreadyComplete
            ? 'Review or update your merchant configuration.'
            : 'Complete a few steps to configure how you accept and receive payments.'}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <StepDot active={i === step} done={i < step} step={i + 1} />
              <span
                className={cn(
                  'hidden text-xs font-medium sm:block',
                  i === step ? 'text-[color:var(--merchant-text)]' : 'text-[color:var(--merchant-muted)]',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-px w-8',
                  i < step ? 'bg-emerald-500' : 'bg-[color:var(--merchant-border)]',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-6 space-y-6">

        {/* Step 0 — Business type */}
        {step === 0 && (
          <>
            <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">What type of merchant are you?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {MERCHANT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, merchantType: opt.value }))}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all duration-150',
                    form.merchantType === opt.value
                      ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                      : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
                  )}
                >
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs leading-5',
                      form.merchantType === opt.value
                        ? 'text-[color:var(--merchant-action-fg)]/60'
                        : 'text-[color:var(--merchant-muted)]',
                    )}
                  >
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 1 — Location & currency */}
        {step === 1 && (
          <>
            <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">Where do you operate?</h2>
            <div className="space-y-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">Country</span>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3 text-sm text-[color:var(--merchant-text)] outline-none transition-colors focus:border-[color:var(--merchant-strong-border)] focus:bg-[color:var(--merchant-panel-strong)]"
                >
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div>
                <p className="text-xs font-medium text-[color:var(--merchant-soft-text)] mb-1">Settlement currency</p>
                <p className="text-xs text-[color:var(--merchant-muted)] mb-3">This is the currency your payouts will be denominated in.</p>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, baseCurrency: c }))}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                        form.baseCurrency === c
                          ? 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                          : 'border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)]',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 2 — Settlement */}
        {step === 2 && (
          <>
            <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">How should we settle your payments?</h2>
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {SETTLEMENT_MODES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, settlementMode: opt.value }))}
                    className={cn(
                      'rounded-xl border p-4 text-left transition-all duration-150',
                      form.settlementMode === opt.value
                        ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                        : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
                    )}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p
                      className={cn(
                        'mt-1 text-xs leading-5',
                        form.settlementMode === opt.value
                          ? 'text-[color:var(--merchant-action-fg)]/60'
                          : 'text-[color:var(--merchant-muted)]',
                      )}
                    >
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-xs font-medium text-[color:var(--merchant-soft-text)] mb-2">Payout schedule</p>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, payoutSchedule: opt.value }))}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                        form.payoutSchedule === opt.value
                          ? 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                          : 'border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-muted)] hover:text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)]',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[color:var(--merchant-muted)]">
                  {SCHEDULES.find((s) => s.value === form.payoutSchedule)?.description}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Step 3 — Store */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">Name your store</h2>
              <p className="mt-1 text-xs text-[color:var(--merchant-muted)]">
                This is the public-facing name customers see on payment pages and receipts.
              </p>
            </div>
            <MerchantInput
              label="Store name"
              type="text"
              value={form.storeName}
              onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
              placeholder="e.g. Acme Stores"
            />

            {/* Summary */}
            <div className="rounded-xl bg-[color:var(--merchant-action-bg)] p-5 space-y-2.5 text-sm">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--merchant-action-fg)]/50 mb-3">Configuration summary</p>
              {[
                { label: 'Merchant type', value: form.merchantType.replace('_', ' ') },
                { label: 'Country', value: form.country },
                { label: 'Currency', value: form.baseCurrency },
                { label: 'Settlement', value: form.settlementMode.replace(/_/g, ' ') },
                { label: 'Schedule', value: form.payoutSchedule },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[color:var(--merchant-action-fg)]/60">{label}</span>
                  <span className="font-medium capitalize text-[color:var(--merchant-action-fg)]">{value}</span>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-sm text-rose-500">{error}</p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <MerchantButton variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </MerchantButton>
        ) : (
          <div />
        )}

        {step < steps.length - 1 ? (
          <MerchantButton variant="primary" onClick={() => setStep((s) => s + 1)}>
            Continue
          </MerchantButton>
        ) : (
          <MerchantButton
            variant="primary"
            onClick={handleFinish}
            disabled={saving || !form.storeName.trim()}
            loading={saving}
          >
            {alreadyComplete ? 'Save changes' : 'Finish setup'}
          </MerchantButton>
        )}
      </div>
    </div>
  );
}
