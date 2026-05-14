'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MerchantShell } from '@/features/merchant/components/layout/merchant-shell';
import { useMerchantAuthStore } from '@/features/merchant/store/merchant-auth-store';

export default function MerchantConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session  = useMerchantAuthStore((s) => s.session);
  const hydrated = useMerchantAuthStore((s) => s.hydrated);
  const signOut  = useMerchantAuthStore((s) => s.signOut);

  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/merchant/sign-in');
    }
  }, [hydrated, router, session]);

  // When the refresh token is also expired/revoked, clear session and redirect
  useEffect(() => {
    function handleAuthExpired() {
      signOut();
      router.replace('/merchant/sign-in');
    }
    window.addEventListener('merchant:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('merchant:auth:expired', handleAuthExpired);
  }, [router, signOut]);

  if (!hydrated || !session) {
    return (
      <div className="merchant-theme min-h-screen bg-[color:var(--merchant-bg)]" data-theme="light">
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-[24px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-6 py-5 text-sm text-[color:var(--merchant-muted)]">
            Loading merchant workspace...
          </div>
        </div>
      </div>
    );
  }

  return <MerchantShell>{children}</MerchantShell>;
}
