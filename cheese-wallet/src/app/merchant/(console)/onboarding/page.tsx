'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import { completeMerchantOnboarding } from '@/features/merchant/lib/merchant-api';
import { MerchantButton } from '@/features/merchant/components/shared/primitives';
import type { SettlementMode, PayoutSchedule, MerchantType } from '@/features/merchant/types';

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
    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
      done
        ? 'bg-emerald-500 text-white'
        : active
        ? 'bg-[#0f172a] text-white'
        : 'bg-[color:var(--merchant-border)] text-[color:var(--merchant-muted)]'
    }`}>
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
  const { session, completeOnboarding } = useMerchantAuthStore((state) => ({
    session: state.session,
    completeOnboarding: state.completeOnboarding,
  }));

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

  // If already onboarded, skip to confirmation
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
              <span className={`hidden text-xs font-medium sm:block ${i === step ? 'text-[color:var(--merchant-text)]' : 'text-[color:var(--merchant-muted)]'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-8 ${i < step ? 'bg-emerald-500' : 'bg-[color:var(--merchant-border)]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-[24px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-6 space-y-6">

        {/* Step 0 — Business type */}
        {step === 0 && (
          <>
            <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">What type of merchant are you?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {MERCHANT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, merchantType: opt.value }))}
                  className={`rounded-[20px] border p-5 text-left transition ${
                    form.merchantType === opt.value
                      ? 'border-[#0f172a] bg-[#0f172a] text-white'
                      : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-text)]'
                  }`}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className={`mt-1 text-sm ${form.merchantType === opt.value ? 'opacity-70' : 'text-[color:var(--merchant-muted)]'}`}>
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
            <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">Where do you operate?</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--merchant-text)] mb-1.5">Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="w-full rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] px-3 py-2.5 text-sm text-[color:var(--merchant-text)] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
                >
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--merchant-text)] mb-1.5">Settlement currency</label>
                <p className="text-xs text-[color:var(--merchant-muted)] mb-2">This is the currency your payouts will be denominated in.</p>
                <div className="flex flex-wrap gap-2">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, baseCurrency: c }))}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        form.baseCurrency === c
                          ? 'bg-[#0f172a] text-white'
                          : 'bg-[color:var(--merchant-bg)] border border-[color:var(--merchant-border)] text-[color:var(--merchant-muted)]'
                      }`}
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
            <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">How should we settle your payments?</h2>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {SETTLEMENT_MODES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, settlementMode: opt.value }))}
                    className={`rounded-[20px] border p-5 text-left transition ${
                      form.settlementMode === opt.value
                        ? 'border-[#0f172a] bg-[#0f172a] text-white'
                        : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-text)]'
                    }`}
                  >
                    <p className="font-semibold">{opt.label}</p>
                    <p className={`mt-1 text-sm ${form.settlementMode === opt.value ? 'opacity-70' : 'text-[color:var(--merchant-muted)]'}`}>
                      {opt.description}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium text-[color:var(--merchant-text)] mb-2">Payout schedule</p>
                <div className="flex flex-wrap gap-2">
                  {SCHEDULES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, payoutSchedule: opt.value }))}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        form.payoutSchedule === opt.value
                          ? 'bg-[#0f172a] text-white'
                          : 'bg-[color:var(--merchant-bg)] border border-[color:var(--merchant-border)] text-[color:var(--merchant-muted)]'
                      }`}
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
            <h2 className="text-base font-semibold text-[color:var(--merchant-text)]">Name your store</h2>
            <p className="text-sm text-[color:var(--merchant-muted)]">
              This is the public-facing name customers see on payment pages and receipts.
            </p>
            <div>
              <label className="block text-sm font-medium text-[color:var(--merchant-text)] mb-1.5">Store name</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                placeholder="e.g. Acme Stores"
                className="w-full rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-bg)] px-3 py-2.5 text-sm text-[color:var(--merchant-text)] placeholder:text-[color:var(--merchant-muted)] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
              />
            </div>

            {/* Summary */}
            <div className="rounded-[20px] bg-[#0f172a] p-5 text-white space-y-2 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50 mb-3">Summary</p>
              <div className="flex justify-between">
                <span className="text-white/60">Merchant type</span>
                <span className="font-medium capitalize">{form.merchantType.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Country</span>
                <span className="font-medium">{form.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Currency</span>
                <span className="font-medium">{form.baseCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Settlement</span>
                <span className="font-medium capitalize">{form.settlementMode.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Schedule</span>
                <span className="font-medium capitalize">{form.payoutSchedule}</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <MerchantButton variant="ghost" onClick={() => setStep((s) => s - 1)} className="h-10 px-5">
            Back
          </MerchantButton>
        ) : (
          <div />
        )}

        {step < steps.length - 1 ? (
          <MerchantButton variant="primary" onClick={() => setStep((s) => s + 1)} className="h-10 px-6">
            Continue
          </MerchantButton>
        ) : (
          <MerchantButton
            variant="primary"
            onClick={handleFinish}
            disabled={saving || !form.storeName.trim()}
            className="h-10 px-6"
          >
            {saving ? 'Saving...' : alreadyComplete ? 'Save changes' : 'Finish setup'}
          </MerchantButton>
        )}
      </div>
    </div>
  );
}
