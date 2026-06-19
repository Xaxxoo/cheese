'use client'

import Image from 'next/image'
import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const px = { sm: 16, md: 24, lg: 32 } as const

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Image
      src="/trionda.png"
      alt=""
      width={px[size]}
      height={px[size]}
      className={cn('animate-spin', className)}
      aria-hidden="true"
      priority
    />
  )
}
