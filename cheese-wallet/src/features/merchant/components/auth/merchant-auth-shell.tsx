import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Zap } from 'lucide-react';

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
    <div className="merchant-theme min-h-screen bg-[color:var(--merchant-bg)] text-[color:var(--merchant-text)]" data-theme="light">
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,118,110,0.12),transparent_26%)]" />
        <div className="mx-auto grid min-h-screen w-full max-w-[1440px] gap-10 px-4 py-6 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:py-10">
          <section className="merchant-panel relative overflow-hidden rounded-[36px] px-6 py-8 md:px-8 md:py-10">
            <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(29,78,216,0.08),transparent)]" />
            <div className="relative flex h-full flex-col">
              <Link
                href="/merchant/sign-in"
                className="inline-flex items-center gap-3 text-sm font-semibold text-[color:var(--merchant-text)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span>
                  CheesePay Merchant
                  <span className="block text-xs font-medium text-[color:var(--merchant-muted)]">
                    Crypto-to-fiat settlement infrastructure
                  </span>
                </span>
              </Link>

              <div className="mt-14 max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--merchant-muted)]">
                  {eyebrow}
                </p>
                <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-[color:var(--merchant-text)] sm:text-6xl">
                  {title}
                </h1>
                <p className="mt-5 max-w-lg text-base leading-8 text-[color:var(--merchant-muted)]">
                  {description}
                </p>
              </div>

              <div className="mt-12 grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: 'Instant payout',
                    body: 'Settle confirmed customer payments directly to local bank accounts.',
                    icon: Zap,
                  },
                  {
                    title: 'Developer rails',
                    body: 'Issue payment links, sessions, and callbacks from a clean merchant API.',
                    icon: ArrowRight,
                  },
                  {
                    title: 'Enterprise controls',
                    body: 'Operate with roles, audit trails, and secure payout policies.',
                    icon: ShieldCheck,
                  },
                ].map((item) => (
                  <article
                    key={item.title}
                    className="rounded-[24px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] p-4"
                  >
                    <item.icon className="h-5 w-5 text-[#1d4ed8]" />
                    <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--merchant-muted)]">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>

              <div className="mt-auto pt-12 text-sm text-[color:var(--merchant-soft-text)]">
                Accept digital dollars. Settle like modern commerce software.
              </div>
            </div>
          </section>

          <section className="flex items-center lg:justify-end">
            <div className="w-full max-w-[560px] rounded-[32px] border border-[color:var(--merchant-border)] bg-[color:var(--merchant-header)]/92 p-6 shadow-[0_36px_120px_rgba(15,23,42,0.12)] backdrop-blur-xl md:p-8">
              {children}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
