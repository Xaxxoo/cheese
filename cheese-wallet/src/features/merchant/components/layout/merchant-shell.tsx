'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Code2,
  CreditCard,
  Home,
  LayoutTemplate,
  LogOut,
  Menu,
  MoonStar,
  ReceiptText,
  SunMedium,
  X,
  Sparkles,
} from 'lucide-react';
import { useMerchantRealtime } from '../../hooks/use-merchant-realtime';
import { useMerchantAuthStore } from '../../store/merchant-auth-store';
import { useMerchantUiStore } from '../../store/merchant-ui-store';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { href: '/merchant/dashboard',   label: 'Dashboard',   icon: Home },
  { href: '/merchant/payments',    label: 'Payments',    icon: CreditCard },
  { href: '/merchant/settlements', label: 'Settlements', icon: ReceiptText },
  { href: '/merchant/developer',   label: 'Developer',   icon: Code2 },
  { href: '/merchant/onboarding',  label: 'Onboarding',  icon: LayoutTemplate },
] as const;

function MerchantRealtimeBridge() {
  useMerchantRealtime();
  return null;
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
        active
          ? 'bg-[color:var(--merchant-panel-strong)] text-[color:var(--merchant-text)] font-medium'
          : 'text-[color:var(--merchant-soft-text)] hover:bg-[color:var(--merchant-panel)] hover:text-[color:var(--merchant-text)]',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0 transition-opacity',
          active ? 'opacity-100' : 'opacity-60 group-hover:opacity-80',
        )}
      />
      <span className="truncate">{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#D4A843]" />
      )}
    </Link>
  );
}

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const pathname        = usePathname();
  const router          = useRouter();
  const session         = useMerchantAuthStore((s) => s.session);
  const signOut         = useMerchantAuthStore((s) => s.signOut);
  const theme           = useMerchantUiStore((s) => s.theme);
  const toggleTheme     = useMerchantUiStore((s) => s.toggleTheme);
  const mobileNavOpen   = useMerchantUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useMerchantUiStore((s) => s.setMobileNavOpen);

  const merchantName = session?.merchant.displayName ?? 'Merchant';
  const userInitials = session?.user?.fullName
    ? session.user.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  const activeLabel = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? 'Console';

  function handleSignOut() {
    signOut();
    router.replace('/merchant/sign-in');
  }

  return (
    <div className="merchant-theme min-h-screen" data-theme={theme}>
      <MerchantRealtimeBridge />

      <div className="relative min-h-screen bg-[color:var(--merchant-bg)] text-[color:var(--merchant-text)]">
        {/* ── Desktop sidebar ── */}
        <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col border-r border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] xl:flex">
          {/* Logo */}
          <div className="flex h-14 items-center gap-2.5 px-5 border-b border-[color:var(--merchant-border)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4A843] text-[#09090C]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">CheesePay</p>
              <p className="text-[10px] text-[color:var(--merchant-muted)]">Merchant</p>
            </div>
          </div>

          {/* Merchant info */}
          <div className="px-4 pt-5 pb-2">
            <div className="rounded-lg border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] px-3.5 py-3">
              <p className="text-xs font-medium text-[color:var(--merchant-text)] truncate">{merchantName}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[11px] text-[color:var(--merchant-muted)]">
                  {session?.merchant.country} · {session?.merchant.baseCurrency}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 pt-2 pb-4">
            <div className="mb-1 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--merchant-muted)]">
                Navigation
              </p>
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </nav>

          {/* User footer */}
          <div className="border-t border-[color:var(--merchant-border)] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--merchant-panel-strong)] text-xs font-semibold text-[color:var(--merchant-text)]">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[color:var(--merchant-text)]">
                  {session?.user?.fullName ?? 'Merchant'}
                </p>
                <p className="truncate text-[10px] text-[color:var(--merchant-muted)]">
                  {session?.user?.email ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-shrink-0 rounded-md p-1 text-[color:var(--merchant-muted)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex min-h-screen flex-col xl:pl-[232px]">
          {/* Header */}
          <header className="sticky top-0 z-30 h-14 border-b border-[color:var(--merchant-border)] bg-[color:var(--merchant-header)] backdrop-blur-xl">
            <div className="flex h-full items-center gap-3 px-4 sm:px-6">
              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--merchant-border)] text-[color:var(--merchant-soft-text)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] xl:hidden"
              >
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>

              {/* Page title */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <h1 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                  {activeLabel}
                </h1>
                <span className="hidden h-5 items-center rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2 text-[10px] font-medium text-emerald-500 sm:inline-flex">
                  Live
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--merchant-border)] text-[color:var(--merchant-soft-text)] transition-all hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? (
                    <MoonStar className="h-3.5 w-3.5" />
                  ) : (
                    <SunMedium className="h-3.5 w-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--merchant-border)] text-[color:var(--merchant-soft-text)] transition-all hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]"
                  aria-label="Notifications"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#D4A843]" />
                </button>

                <div className="ml-1 hidden h-5 w-px bg-[color:var(--merchant-border)] sm:block" />

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[color:var(--merchant-soft-text)] transition-colors hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)] sm:inline-flex"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>
            </div>
          </header>

          {/* Mobile nav drawer */}
          {mobileNavOpen && (
            <div className="border-b border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] px-3 py-3 xl:hidden">
              <nav className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    active={pathname.startsWith(item.href)}
                    onClick={() => setMobileNavOpen(false)}
                  />
                ))}
              </nav>
            </div>
          )}

          {/* Page content */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1320px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
