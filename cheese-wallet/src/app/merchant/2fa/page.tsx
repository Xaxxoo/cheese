'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantAuthShell } from '@/features/merchant/components/auth/merchant-auth-shell';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import { completeMerchantTwoFactor } from '@/features/merchant/lib/merchant-api';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

export default function MerchantTwoFactorPage() {
  const router = useRouter();
  const { pendingEmail, pendingIntent, completeChallenge } = useMerchantAuthStore(
    (state) => ({
      pendingEmail: state.pendingEmail,
      pendingIntent: state.pendingIntent,
      completeChallenge: state.completeChallenge,
    }),
  );
  const [code, setCode] = useState('104288');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingEmail) router.replace('/merchant/sign-in');
  }, [pendingEmail, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingEmail) return;
    setError('');
    setLoading(true);

    try {
      const session = await completeMerchantTwoFactor({ email: pendingEmail, code });
      completeChallenge({
        ...session,
        onboardingComplete:
          pendingIntent === 'sign-up' ? false : session.onboardingComplete,
      });
      router.replace(
        pendingIntent === 'sign-up' ? '/merchant/onboarding' : '/merchant/dashboard',
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not verify authenticator code.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MerchantAuthShell
      eyebrow="Two-factor authentication"
      title="Final security check before you enter the merchant workspace."
      description="Sensitive payout, API, and settlement controls require a second factor every time you begin an authenticated merchant session."
    >
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            Authenticator code
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
            Enter the code for {pendingEmail ?? 'your account'} to continue into the merchant dashboard.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <MerchantInput
            label="2FA code"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            hint="Authenticator demo code is prefilled for the local build."
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <MerchantButton type="submit" className="w-full h-12" loading={loading}>
            Enter merchant workspace
          </MerchantButton>
        </form>
      </div>
    </MerchantAuthShell>
  );
}
