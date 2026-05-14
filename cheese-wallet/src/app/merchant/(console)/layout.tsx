'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantShell } from '@/features/merchant/components/layout/merchant-shell';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';
import type { MerchantSession } from '@/features/merchant/types';

/* ── Dev bypass ─────────────────────────────────────────────────────────────
   Set NEXT_PUBLIC_MERCHANT_DEV_BYPASS=true in .env.local to skip auth and
   view the merchant UI without a real backend session.
   ──────────────────────────────────────────────────────────────────────── */
const DEV_BYPASS =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_MERCHANT_DEV_BYPASS === 'true';

const DEV_SESSION: MerchantSession = {
  accessToken: 'dev-bypass',
  sandboxMode: true,
  onboardingComplete: true,
  user: {
    id: 'usr_dev',
    fullName: 'Dev User',
    email: 'dev@cheesepay.com',
    role: 'owner',
    permissions: ['*'],
    twoFactorEnabled: true,
    lastLoginAt: new Date().toISOString(),
  },
  merchant: {
    id: 'mch_dev',
    merchantType: 'business',
    displayName: 'Demo Store',
    legalName: 'Demo Store Ltd',
    country: 'Nigeria',
    baseCurrency: 'NGN',
    defaultSettlementMode: 'instant_fiat',
    payoutSchedule: 'instant',
    kycStatus: 'verified',
    kybStatus: 'verified',
    stores: [],
  },
};

export default function MerchantConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router   = useRouter();
  const session  = useMerchantAuthStore((s) => s.session);
  const hydrated = useMerchantAuthStore((s) => s.hydrated);
  const signOut  = useMerchantAuthStore((s) => s.signOut);
  const completeChallenge = useMerchantAuthStore((s) => s.completeChallenge);

  // Seed the store with the dev session once on mount (bypass mode only)
  useEffect(() => {
    if (DEV_BYPASS && !session) {
      completeChallenge(DEV_SESSION);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (DEV_BYPASS) return;
    if (hydrated && !session) {
      router.replace('/merchant/sign-in');
    }
  }, [hydrated, router, session]);

  useEffect(() => {
    if (DEV_BYPASS) return;
    function handleAuthExpired() {
      signOut();
      router.replace('/merchant/sign-in');
    }
    window.addEventListener('merchant:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('merchant:auth:expired', handleAuthExpired);
  }, [router, signOut]);

  if (!DEV_BYPASS && (!hydrated || !session)) {
    return (
      <div className="merchant-theme min-h-screen bg-[color:var(--merchant-bg)]" data-theme="light">
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-6 py-5 text-sm text-[color:var(--merchant-muted)]">
            Loading merchant workspace...
          </div>
        </div>
      </div>
    );
  }

  return <MerchantShell>{children}</MerchantShell>;
}
