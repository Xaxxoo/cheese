'use client';

import { useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';

/* ─── Button ──────────────────────────────────────────── */

export function MerchantButton({
  className,
  children,
  variant = 'primary',
  loading = false,
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(212,168,67,0.5)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--merchant-bg)]',
        size === 'sm' && 'h-7 rounded-md px-2.5 text-xs',
        size === 'md' && 'h-9 rounded-lg px-3.5 text-sm',
        size === 'lg' && 'h-11 rounded-xl px-5 text-sm',
        variant === 'primary' && [
          'bg-[color:var(--merchant-action-bg)] text-[color:var(--merchant-action-fg)]',
          'hover:bg-[color:var(--merchant-action-hover)]',
          'active:scale-[0.98]',
        ],
        variant === 'secondary' && [
          'border border-[color:var(--merchant-border)] bg-transparent text-[color:var(--merchant-text)]',
          'hover:bg-[color:var(--merchant-panel-strong)] hover:border-[color:var(--merchant-strong-border)]',
          'active:scale-[0.98]',
        ],
        variant === 'ghost' && [
          'bg-transparent text-[color:var(--merchant-soft-text)]',
          'hover:bg-[color:var(--merchant-panel-strong)] hover:text-[color:var(--merchant-text)]',
          'active:scale-[0.98]',
        ],
        variant === 'danger' && [
          'bg-rose-500/10 text-rose-400 border border-rose-500/20',
          'hover:bg-rose-500/16 hover:border-rose-500/30',
          'active:scale-[0.98]',
        ],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

/* ─── Input ───────────────────────────────────────────── */

export function MerchantInput({
  label,
  hint,
  error,
  suffix,
  prefix,
  className,
  style,
  onFocus,
  onBlur,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
  prefix?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-medium text-[color:var(--merchant-soft-text)]">
          {label}
        </span>
      )}
      <span className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 text-[color:var(--merchant-muted)]">
            {prefix}
          </span>
        )}
        <input
          className={cn(
            'h-9 w-full rounded-lg border text-sm outline-none transition-all duration-150',
            'text-[color:var(--merchant-text)]',
            'border-[color:var(--merchant-border)] placeholder:text-[color:var(--merchant-muted)]',
            focused
              ? 'border-[color:var(--merchant-strong-border)]'
              : '',
            prefix && 'pl-9',
            suffix && 'pr-10',
            !prefix && 'px-3.5',
            error && 'border-rose-500/40',
            focused && error && 'border-rose-500/60',
            props.readOnly && 'opacity-60 cursor-default',
            className,
          )}
          style={{
            backgroundColor: focused
              ? 'var(--merchant-input-bg-focus)'
              : 'var(--merchant-input-bg)',
            WebkitTextFillColor: 'var(--merchant-text)',
            caretColor: 'var(--merchant-text)',
            ...style,
          }}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3.5 text-xs font-medium text-[color:var(--merchant-muted)]">
            {suffix}
          </span>
        )}
      </span>
      {error ? (
        <span className="text-xs text-rose-400">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[color:var(--merchant-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

/* ─── Section Card ────────────────────────────────────── */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  noPadding = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  const hasHeader = title || description || action;
  return (
    <section
      className={cn(
        'rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)]',
        !noPadding && 'p-5',
        className,
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            'flex items-start justify-between gap-4',
            !noPadding && (title || description) ? 'mb-5' : '',
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-[color:var(--merchant-text)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-5 text-[color:var(--merchant-muted)]">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ─── Metric Card ─────────────────────────────────────── */

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
    <article className="group rounded-xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel)] p-4 transition-colors hover:bg-[color:var(--merchant-panel-strong)]">
      <p className="text-xs font-medium text-[color:var(--merchant-muted)] truncate">{label}</p>
      <p className="mt-2.5 font-merchant-serif text-2xl font-semibold tracking-tight text-[color:var(--merchant-text)]">
        {amount}
      </p>
      <p
        className={cn(
          'mt-2 inline-flex items-center gap-1 text-xs font-medium',
          tone === 'positive' && 'text-emerald-500',
          tone === 'neutral'  && 'text-[color:var(--merchant-muted)]',
          tone === 'warning'  && 'text-amber-500',
        )}
      >
        {tone === 'positive' && (
          <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
            <path d="M6 2l4 4H7v4H5V6H2l4-4z" />
          </svg>
        )}
        {tone === 'warning' && (
          <svg viewBox="0 0 12 12" fill="currentColor" className="h-3 w-3">
            <path d="M6 10L2 6h3V2h2v4h3L6 10z" />
          </svg>
        )}
        {trend}
      </p>
    </article>
  );
}

/* ─── Empty State ─────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--merchant-border)] text-[color:var(--merchant-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[color:var(--merchant-text)]">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[color:var(--merchant-muted)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
