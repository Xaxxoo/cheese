'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function MerchantButton({
  className,
  children,
  variant = 'primary',
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' &&
          'bg-[#0f172a] text-white shadow-[0_18px_60px_rgba(15,23,42,0.16)] hover:-translate-y-0.5 hover:bg-[#111c33]',
        variant === 'secondary' &&
          'border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] text-[color:var(--merchant-text)] hover:border-[color:var(--merchant-strong-border)] hover:bg-[color:var(--merchant-panel-strong)]',
        variant === 'ghost' &&
          'text-[color:var(--merchant-muted)] hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function MerchantInput({
  label,
  hint,
  error,
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
          {label}
        </span>
      )}
      <span className="relative flex items-center">
        <input
          className={cn(
            'h-12 w-full rounded-2xl border bg-[color:var(--merchant-panel)] px-4 text-sm text-[color:var(--merchant-text)] outline-none transition duration-200',
            'border-[color:var(--merchant-border)] placeholder:text-[color:var(--merchant-soft-text)]',
            'focus:border-[color:var(--merchant-strong-border)] focus:bg-[color:var(--merchant-panel-strong)]',
            suffix && 'pr-12',
            error && 'border-rose-400/60',
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 text-xs font-medium text-[color:var(--merchant-muted)]">
            {suffix}
          </span>
        )}
      </span>
      {error ? (
        <span className="text-xs text-rose-500">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[color:var(--merchant-soft-text)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'merchant-panel rounded-[28px] p-6 md:p-7',
        className,
      )}
    >
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[color:var(--merchant-text)]">
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--merchant-muted)]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  amount,
  trend,
  tone,
}: {
  label: string;
  amount: string;
  trend: string;
  tone: 'positive' | 'neutral' | 'warning';
}) {
  return (
    <article className="merchant-panel rounded-[24px] p-5">
      <p className="text-sm font-medium text-[color:var(--merchant-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[color:var(--merchant-text)]">
        {amount}
      </p>
      <p
        className={cn(
          'mt-3 text-sm',
          tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'neutral' && 'text-[color:var(--merchant-muted)]',
          tone === 'warning' && 'text-amber-600 dark:text-amber-300',
        )}
      >
        {trend}
      </p>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] px-6 py-10 text-center">
      <h3 className="text-lg font-semibold text-[color:var(--merchant-text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--merchant-muted)]">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
