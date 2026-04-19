import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const variants = {
  primary:   'bg-[#d4a843] text-black font-semibold hover:bg-[#c49a38] active:scale-[0.98]',
  secondary: 'bg-white/8 border border-white/10 text-white hover:bg-white/12 active:scale-[0.98]',
  ghost:     'text-white/60 hover:text-white hover:bg-white/6 active:scale-[0.98]',
  danger:    'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 active:scale-[0.98]',
}

const sizes = {
  sm: 'h-9 px-4 text-sm rounded-xl',
  md: 'h-12 px-5 text-sm rounded-2xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
