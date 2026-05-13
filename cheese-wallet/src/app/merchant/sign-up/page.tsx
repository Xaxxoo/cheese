'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantAuthShell } from '@/features/merchant/components/auth/merchant-auth-shell';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import { registerMerchant } from '@/features/merchant/lib/merchant-api';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

export default function MerchantSignUpPage() {
  const router = useRouter();
  const beginChallenge = useMerchantAuthStore((state) => state.beginChallenge);
  const [form, setForm] = useState({
    fullName: 'Amaka Eze',
    email: 'ops@lumena.market',
    password: 'merchant-demo',
    businessName: 'Lumena Market',
    country: 'Nigeria',
    baseCurrency: 'NGN',
    settlementMode: 'instant_fiat' as const,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerMerchant(form);
      beginChallenge(response.email, 'sign-up');
      router.push('/merchant/verify');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not create merchant account.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MerchantAuthShell
      eyebrow="Merchant onboarding"
      title="Launch a premium merchant payment operation in minutes."
      description="Create your CheesePay merchant account, choose how you want to settle, and unlock payment collection that feels like fintech software instead of blockchain tooling."
    >
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            Create merchant account
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
            Start in sandbox, verify your team email, then configure stores and payouts.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <MerchantInput
              label="Full name"
              value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)}
            />
            <MerchantInput
              label="Business name"
              value={form.businessName}
              onChange={(event) => update('businessName', event.target.value)}
            />
            <MerchantInput
              label="Work email"
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
            <MerchantInput
              label="Password"
              type="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
                Country
              </span>
              <select
                value={form.country}
                onChange={(event) => update('country', event.target.value)}
                className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
              >
                <option>Nigeria</option>
                <option>United Kingdom</option>
                <option>United States</option>
                <option>Kenya</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
                Base currency
              </span>
              <select
                value={form.baseCurrency}
                onChange={(event) => update('baseCurrency', event.target.value)}
                className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
              >
                <option value="NGN">NGN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
                Settlement preference
              </span>
              <select
                value={form.settlementMode}
                onChange={(event) =>
                  update('settlementMode', event.target.value as typeof form.settlementMode)
                }
                className="h-12 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none"
              >
                <option value="instant_fiat">Instant fiat settlement</option>
                <option value="hold_usdc">Hold as digital dollar</option>
              </select>
            </label>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <MerchantButton type="submit" className="w-full h-12" loading={loading}>
            Create account
          </MerchantButton>
        </form>

        <p className="mt-6 text-sm text-[color:var(--merchant-muted)]">
          Already have access?{' '}
          <Link href="/merchant/sign-in" className="font-semibold text-[color:var(--merchant-text)]">
            Sign in
          </Link>
        </p>
      </div>
    </MerchantAuthShell>
  );
}
