import { cn } from '@/lib/cn'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  hint?: string
  suffix?: ReactNode
  prefix?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  suffix,
  prefix,
  className,
  id,
  style,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-white/50 tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <div className={cn('relative flex items-center', error && 'group/error')}>
        {prefix && (
          <span className="absolute left-4 text-white/40 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            'w-full h-12 bg-white/6 border rounded-2xl px-4 text-sm text-white',
            'placeholder:text-white/30',
            'transition-all duration-150',
            'focus:outline-none focus:border-[#d4a843]/60 focus:bg-white/8',
            error
              ? 'border-red-500/40 focus:border-red-500/60'
              : 'border-white/10',
            prefix && 'pl-9',
            suffix && 'pr-12',
            className,
          )}
          style={{ WebkitTextFillColor: 'white', caretColor: 'white', ...style }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-4 text-white/40 text-sm">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-white/35">{hint}</p>
      )}
    </div>
  )
}
