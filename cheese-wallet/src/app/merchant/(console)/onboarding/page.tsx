'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  CalendarDays,
  Coins,
  User2,
  Zap,
} from 'lucide-react';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import { completeMerchantOnboarding } from '@/features/merchant/lib/merchant-api';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import type { SettlementMode, PayoutSchedule, MerchantType } from '@/features/merchant/types';
import { cn } from '@/lib/cn';

// ── Config ────────────────────────────────────────────────────────────────────

const MERCHANT_TYPES: {
  value: MerchantType;
  label: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  {
    value: 'individual',
    label: 'Individual / Sole trader',
    description: 'You operate as a freelancer or individual seller.',
    Icon: User2,
  },
  {
    value: 'business',
    label: 'Registered business',
    description: 'You have a registered business entity (Ltd, Inc, LLC, etc.).',
    Icon: Building2,
  },
];

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'GHS', 'ZAR'];
const COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa',
  'United Kingdom', 'United States', 'Germany', 'France',
];

const SETTLEMENT_MODES: {
  value: SettlementMode;
  label: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  {
    value: 'instant_fiat',
    label: 'Instant fiat payout',
    description: 'Convert payments to local currency and send to your bank as soon as they confirm.',
    Icon: Zap,
  },
  {
    value: 'hold_usdc',
    label: 'Hold digital dollars',
    description: 'Keep cleared value in your digital dollar merchant balance for treasury use.',
    Icon: Coins,
  },
];

const SCHEDULES: {
  value: PayoutSchedule;
  label: string;
  description: string;
  Icon: React.ElementType;
}[] = [
  { value: 'instant', label: 'Instant',  description: 'Flush settled balance as each payment clears.', Icon: Zap },
  { value: 'daily',   label: 'Daily',    description: 'Batch payouts once per day at 17:00 UTC.',       Icon: Calendar },
  { value: 'weekly',  label: 'Weekly',   description: 'Batch payouts every Monday at 17:00 UTC.',       Icon: CalendarDays },
];

const STEPS = ['Business type', 'Location', 'Settlement', 'Store'];

// ── Option card ───────────────────────────────────────────────────────────────

function OptionCard({
  selected,
  onClick,
  Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  Icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-xl border p-4 text-left transition-all duration-150',
        selected
          ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
          : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
      )}
    >
      {/* Check indicator */}
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-white">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      )}

      {/* Icon */}
      <div
        className={cn(
          'mb-3 flex h-9 w-9 items-center justify-center rounded-lg',
          selected
            ? 'bg-[color:var(--merchant-action-fg)]/10'
            : 'bg-[color:var(--merchant-panel-strong)]',
        )}
      >
        <Icon className={cn('h-5 w-5', !selected && 'text-[color:var(--merchant-muted)]')} />
      </div>

      <p className="text-sm font-semibold">{label}</p>
      <p
        className={cn(
          'mt-1 text-xs leading-5',
          selected
            ? 'text-[color:var(--merchant-action-fg)]/60'
            : 'text-[color:var(--merchant-muted)]',
        )}
      >
        {description}
      </p>
    </button>
  );
}

// ── Schedule card (compact 3-col) ─────────────────────────────────────────────

function ScheduleCard({
  selected,
  onClick,
  Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  Icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-xl border p-3.5 text-left transition-all duration-150',
        selected
          ? 'border-[color:var(--merchant-strong-border)] bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
          : 'border-[color:var(--merchant-border)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
      )}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5 text-white">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </span>
      )}
      <Icon className={cn('mb-2 h-4 w-4', !selected && 'text-[color:var(--merchant-muted)]')} />
      <p className="text-xs font-semibold">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-[11px] leading-4',
          selected
            ? 'text-[color:var(--merchant-action-fg)]/60'
            : 'text-[color:var(--merchant-muted)]',
        )}
      >
        {description}
      </p>
    </button>
  );
}

// ── Step dot ──────────────────────────────────────────────────────────────────

function StepDot({ active, done, step }: { active: boolean; done: boolean; step: number }) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
        done  && 'bg-emerald-500 text-white',
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const session            = useMerchantAuthStore((s) => s.session);
  const completeOnboarding = useMerchantAuthStore((s) => s.completeOnboarding);

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    merchantType:   (session?.merchant.merchantType     ?? 'business')       as MerchantType,
    country:         session?.merchant.country          ?? 'Nigeria',
    baseCurrency:    session?.merchant.baseCurrency     ?? 'NGN',
    settlementMode: (session?.merchant.defaultSettlementMode ?? 'instant_fiat') as SettlementMode,
    payoutSchedule: (session?.merchant.payoutSchedule   ?? 'instant')        as PayoutSchedule,
    storeName:       session?.merchant.displayName      ?? '',
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

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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

      {/* Progress stepper */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
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
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-3 flex-1 h-px transition-colors duration-300',
                  i < step ? 'bg-emerald-500' : 'bg-[color:var(--merchant-border)]',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <div
        key={step}
        className="animate-fade-in space-y-6 rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-6"
        style={{ animationFillMode: 'both' }}
      >

        {/* ── Step 0: Business type ─────────────────────────────────── */}
        {step === 0 && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                What type of merchant are you?
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">
                This determines your compliance requirements and onboarding flow.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MERCHANT_TYPES.map((opt) => (
                <OptionCard
                  key={opt.value}
                  selected={form.merchantType === opt.value}
                  onClick={() => set('merchantType', opt.value)}
                  Icon={opt.Icon}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Step 1: Location & currency ───────────────────────────── */}
        {step === 1 && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                Where do you operate?
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">
                Your country and settlement currency determine available payout rails.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">
                Country
              </span>
              <select
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className="h-9 w-full rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-input-bg)] px-3 text-sm text-[color:var(--merchant-text)] outline-none transition-colors focus:border-[color:var(--merchant-strong-border)]"
              >
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-[color:var(--merchant-soft-text)]">
                  Settlement currency
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">
                  The currency your payouts will be denominated in.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('baseCurrency', c)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150',
                      form.baseCurrency === c
                        ? 'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]'
                        : 'border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-muted)] hover:border-[color:var(--merchant-strong-border)] hover:text-[color:var(--merchant-text)]',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Settlement ────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                How should we settle your payments?
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">
                You can change these settings at any time from Settlements.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SETTLEMENT_MODES.map((opt) => (
                <OptionCard
                  key={opt.value}
                  selected={form.settlementMode === opt.value}
                  onClick={() => set('settlementMode', opt.value)}
                  Icon={opt.Icon}
                  label={opt.label}
                  description={opt.description}
                />
              ))}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[color:var(--merchant-soft-text)]">
                Payout schedule
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SCHEDULES.map((opt) => (
                  <ScheduleCard
                    key={opt.value}
                    selected={form.payoutSchedule === opt.value}
                    onClick={() => set('payoutSchedule', opt.value)}
                    Icon={opt.Icon}
                    label={opt.label}
                    description={opt.description}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Store ─────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                Name your store
              </h2>
              <p className="mt-0.5 text-xs text-[color:var(--merchant-muted)]">
                This is the public-facing name customers see on payment pages and receipts.
              </p>
            </div>

            <MerchantInput
              label="Store name"
              type="text"
              value={form.storeName}
              onChange={(e) => set('storeName', e.target.value)}
              placeholder="e.g. Acme Stores"
              autoFocus
            />

            {/* Configuration summary */}
            <div className="overflow-hidden rounded-xl border border-[color:var(--merchant-border)]">
              <div className="border-b border-[color:var(--merchant-border)] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--merchant-muted)]">
                  Configuration summary
                </p>
              </div>
              <div className="divide-y divide-[color:var(--merchant-border)]">
                {[
                  { label: 'Merchant type', value: form.merchantType.replace('_', ' ') },
                  { label: 'Country',        value: form.country },
                  { label: 'Currency',       value: form.baseCurrency },
                  { label: 'Settlement',     value: form.settlementMode.replace(/_/g, ' ') },
                  { label: 'Schedule',       value: form.payoutSchedule },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-[color:var(--merchant-muted)]">{label}</span>
                    <span className="text-xs font-medium capitalize text-[color:var(--merchant-text)]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
                {error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <MerchantButton variant="ghost" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </MerchantButton>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <MerchantButton variant="primary" onClick={() => setStep((s) => s + 1)}>
            Continue →
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
