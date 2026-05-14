'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantAuthShell } from '@/features/merchant/components/auth/merchant-auth-shell';
import { MerchantButton, MerchantInput } from '@/features/merchant/components/shared/primitives';
import { beginMerchantLogin } from '@/features/merchant/lib/merchant-api';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

export default function MerchantSignInPage() {
  const router = useRouter();
  const { session, beginChallenge } = useMerchantAuthStore((state) => ({
    session: state.session,
    beginChallenge: state.beginChallenge,
  }));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace('/merchant/dashboard');
  }, [router, session]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const challenge = await beginMerchantLogin({ email, password });
      beginChallenge(challenge.email, 'sign-in');
      router.push('/merchant/2fa');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not continue with merchant sign in.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MerchantAuthShell
      eyebrow="Merchant sign in"
      title="Operate modern settlement from one calm dashboard."
      description="Log in to issue payment requests, monitor confirmed payments, and move from digital dollars to fiat payouts without exposing your team to blockchain complexity."
    >
      <div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            Welcome back
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
            Continue with email, password, and your six-digit authenticator code.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <MerchantInput
            label="Work email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <MerchantInput
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <MerchantButton type="submit" className="w-full h-12" loading={loading}>
            Continue to 2FA
          </MerchantButton>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-[color:var(--merchant-muted)]">
          <Link href="/merchant/forgot-password" className="font-medium text-[color:var(--merchant-text)]">
            Forgot password
          </Link>
          <Link href="/merchant/sign-up" className="font-medium text-[color:var(--merchant-text)]">
            Create merchant account
          </Link>
        </div>
      </div>
    </MerchantAuthShell>
  );
}
