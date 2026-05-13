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
  const { session, hydrated } = useMerchantAuthStore((state) => ({
    session: state.session,
    hydrated: state.hydrated,
  }));

  useEffect(() => {
    if (hydrated && !session) {
      router.replace('/merchant/sign-in');
    }
  }, [hydrated, router, session]);

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
