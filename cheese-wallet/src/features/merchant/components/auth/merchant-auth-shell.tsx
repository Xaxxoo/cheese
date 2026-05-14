import Link from 'next/link';
import { Sparkles } from 'lucide-react';

const FEATURES = [
  {
    title: 'Instant settlement',
    body: 'Convert confirmed payments to local currency and push to your bank the moment they clear.',
  },
  {
    title: 'Developer-grade rails',
    body: 'Issue checkout sessions, invoices and QR-backed requests from a clean payment API.',
  },
  {
    title: 'Enterprise controls',
    body: 'Roles, audit trails, webhook delivery and secure payout policies — all in one workspace.',
  },
] as const;

export function MerchantAuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="merchant-theme min-h-screen bg-[color:var(--merchant-bg)] text-[color:var(--merchant-text)]"
      data-theme="dark"
    >
      <div className="relative flex min-h-screen">
        {/* ── Left panel (editorial) ── */}
        <div className="hidden flex-col justify-between border-r border-[color:var(--merchant-border)] bg-[color:var(--merchant-side)] px-10 py-10 lg:flex lg:w-[480px] xl:w-[520px]">
          {/* Logo */}
          <Link
            href="/merchant/sign-in"
            className="inline-flex items-center gap-2.5 text-sm font-semibold text-[color:var(--merchant-text)]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4A843] text-[#09090C]">
              <Sparkles className="h-4 w-4" />
            </span>
            CheesePay
          </Link>

          {/* Hero copy */}
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4A843]">
              {eyebrow}
            </p>
            <h1 className="font-merchant-serif text-4xl font-semibold leading-[1.18] tracking-tight text-[color:var(--merchant-text)] xl:text-[44px]">
              {title}
            </h1>
            <p className="max-w-sm text-sm leading-7 text-[color:var(--merchant-soft-text)]">
              {description}
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-3">
                <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md bg-[#D4A843]/10 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4A843]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--merchant-text)]">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[color:var(--merchant-muted)]">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-[11px] text-[color:var(--merchant-muted)]">
            © {new Date().getFullYear()} CheesePay · Crypto-to-fiat settlement infrastructure
          </p>
        </div>

        {/* ── Right panel (form) ── */}
        <div className="flex flex-1 flex-col">
          {/* Mobile logo */}
          <div className="flex items-center justify-between border-b border-[color:var(--merchant-border)] px-5 py-4 lg:hidden">
            <Link
              href="/merchant/sign-in"
              className="inline-flex items-center gap-2 text-sm font-semibold"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D4A843] text-[#09090C]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              CheesePay
            </Link>
          </div>

          {/* Form area */}
          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
            <div className="w-full max-w-[400px]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
