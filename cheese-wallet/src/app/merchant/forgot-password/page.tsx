'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MerchantAuthShell } from '@/features/merchant/components/auth/merchant-auth-shell';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import { requestMerchantPasswordReset } from '@/features/merchant/lib/merchant-api';

export default function MerchantForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await requestMerchantPasswordReset({ email });
      setMessage('Reset instructions sent. Check your inbox and continue in a secure browser.');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not send reset instructions.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MerchantAuthShell
      eyebrow="Recovery"
      title="Recover merchant access without interrupting settlement operations."
      description="Reset access securely, preserve team permissions, and continue processing payments from the same merchant workspace."
    >
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            Forgot password
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
            We’ll send a reset link to your verified work email.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <MerchantInput
            label="Work email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <MerchantButton type="submit" className="w-full h-12" loading={loading}>
            Send reset link
          </MerchantButton>
        </form>

        <p className="mt-6 text-sm text-[color:var(--merchant-muted)]">
          Remembered it?{' '}
          <Link href="/merchant/sign-in" className="font-semibold text-[color:var(--merchant-text)]">
            Back to sign in
          </Link>
        </p>
      </div>
    </MerchantAuthShell>
  );
}
