'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantAuthShell } from '@/features/merchant/components/auth/merchant-auth-shell';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import { verifyMerchantEmail } from '@/features/merchant/lib/merchant-api';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

export default function MerchantVerifyPage() {
  const router = useRouter();
  const pendingEmail = useMerchantAuthStore((s) => s.pendingEmail);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingEmail) {
      router.replace('/merchant/sign-up');
    }
  }, [pendingEmail, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingEmail) return;
    setError('');
    setLoading(true);

    try {
      await verifyMerchantEmail({ email: pendingEmail, code });
      router.push('/merchant/2fa');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not verify merchant email.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MerchantAuthShell
      eyebrow="Verify email"
      title="Prove the team inbox before payments go live."
      description="We verify your merchant contact channel before enabling payment tools, staff invitations, or settlement instructions."
    >
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            Verify your email
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
            Enter the six-digit code sent to {pendingEmail ?? 'your inbox'}.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <MerchantInput
            label="Verification code"
            inputMode="numeric"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            hint="Enter the 6-digit code sent to your email."
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <MerchantButton type="submit" className="w-full h-12" loading={loading}>
            Verify email
          </MerchantButton>
        </form>
      </div>
    </MerchantAuthShell>
  );
}
