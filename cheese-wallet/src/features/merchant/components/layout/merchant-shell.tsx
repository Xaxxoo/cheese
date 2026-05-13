'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  CreditCard,
  Home,
  LayoutTemplate,
  LogOut,
  Menu,
  MoonStar,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { useMerchantRealtime } from '../../hooks/use-merchant-realtime';
import { useMerchantAuthStore } from '../../store/merchant-auth-store';
import { useMerchantUiStore } from '../../store/merchant-ui-store';
import { MerchantButton } from '../shared/primitives';
import { cn } from '@/lib/cn';

const primaryNavigation = [
  { href: '/merchant/dashboard', label: 'Dashboard', icon: Home },
  { href: '/merchant/payments', label: 'Payments', icon: CreditCard },
  { href: '/merchant/settlements', label: 'Settlements', icon: ReceiptText },
  { href: '/merchant/onboarding', label: 'Onboarding', icon: LayoutTemplate },
] as const;

const secondaryNavigation = [
  'Analytics',
  'Customers',
  'API Keys',
  'Webhooks',
  'Team',
  'Store settings',
  'Branding',
  'Notifications',
  'Security',
] as const;

function MerchantRealtimeBridge() {
  useMerchantRealtime();
  return null;
}

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useMerchantAuthStore((state) => ({
    session: state.session,
    signOut: state.signOut,
  }));
  const { theme, toggleTheme, mobileNavOpen, setMobileNavOpen } =
    useMerchantUiStore((state) => ({
      theme: state.theme,
      toggleTheme: state.toggleTheme,
      mobileNavOpen: state.mobileNavOpen,
      setMobileNavOpen: state.setMobileNavOpen,
    }));

  const merchantName = session?.merchant.displayName ?? 'CheesePay Merchant';
  const activeTitle =
    primaryNavigation.find((item) => pathname.startsWith(item.href))?.label ??
    'Merchant Console';

  return (
    <div className="merchant-theme min-h-screen" data-theme={theme}>
      <MerchantRealtimeBridge />
      <div className="relative min-h-screen overflow-hidden bg-[color:var(--merchant-bg)] text-[color:var(--merchant-text)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.12),transparent_36%),radial-gradient(circle_at_top_right,rgba(15,118,110,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.78),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_26%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.68),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-position:center_center] [background-size:72px_72px]" />

        <div className="relative flex min-h-screen">
          <aside className="hidden w-[286px] shrink-0 border-r border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] px-6 py-8 xl:flex xl:flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-[-0.03em]">CheesePay</p>
                <p className="text-sm text-[color:var(--merchant-muted)]">Merchant Console</p>
              </div>
            </div>

            <div className="merchant-panel mt-8 rounded-[24px] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--merchant-muted)]">
                Active account
              </p>
              <p className="mt-3 text-lg font-semibold tracking-[-0.03em]">{merchantName}</p>
              <p className="mt-1 text-sm text-[color:var(--merchant-muted)]">
                {session?.merchant.country} • {session?.merchant.baseCurrency} settlement base
              </p>
            </div>

            <nav className="mt-8 space-y-2">
              {primaryNavigation.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition duration-200',
                      active
                        ? 'bg-[#0f172a] text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]'
                        : 'text-[color:var(--merchant-muted)] hover:bg-[color:var(--merchant-panel)] hover:text-[color:var(--merchant-text)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {active && <ChevronRight className="ml-auto h-4 w-4 opacity-70" />}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-10">
              <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--merchant-soft-text)]">
                Next modules
              </p>
              <div className="mt-3 space-y-1.5">
                {secondaryNavigation.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl px-4 py-3 text-sm text-[color:var(--merchant-soft-text)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto merchant-panel rounded-[24px] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-text)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Enterprise-grade controls</p>
                  <p className="text-xs text-[color:var(--merchant-muted)]">
                    Webhooks, role-based access, audit history.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 border-b border-[color:var(--merchant-border)] bg-[color:var(--merchant-header)]/92 backdrop-blur-xl">
              <div className="flex items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] xl:hidden"
                  onClick={() => setMobileNavOpen(!mobileNavOpen)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
                    Merchant workspace
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <h1 className="truncate text-2xl font-semibold tracking-[-0.04em]">
                      {activeTitle}
                    </h1>
                    <span className="hidden rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300 sm:inline-flex">
                      Live
                    </span>
                  </div>
                </div>

                <div className="hidden items-center gap-3 sm:flex">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]"
                    aria-label="Toggle merchant theme"
                  >
                    {theme === 'light' ? (
                      <MoonStar className="h-4 w-4" />
                    ) : (
                      <SunMedium className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]"
                    aria-label="Merchant notifications"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#ef4444]" />
                  </button>
                  <MerchantButton
                    variant="ghost"
                    onClick={() => {
                      signOut();
                      router.replace('/merchant/sign-in');
                    }}
                    className="h-11 rounded-2xl px-4"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </MerchantButton>
                </div>
              </div>
            </header>

            {mobileNavOpen && (
              <div className="border-b border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] px-4 py-4 xl:hidden">
                <nav className="grid gap-2">
                  {primaryNavigation.map((item) => {
                    const Icon = item.icon;
                    const active = pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileNavOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition duration-200',
                          active
                            ? 'bg-[#0f172a] text-white'
                            : 'bg-[color:var(--merchant-panel)] text-[color:var(--merchant-muted)]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            )}

            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
