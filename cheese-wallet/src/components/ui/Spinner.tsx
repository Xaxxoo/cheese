'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const px = { sm: 16, md: 24, lg: 32 } as const

/**
 * Trionda-inspired soccer ball spinner (FIFA World Cup 2026 season).
 *
 * The Adidas Trionda ball has 4 curved wave panels in the host-nation
 * colours: red (USA/Canada), blue (USA), green (Mexico), white (neutral).
 * The geometry below reproduces the wave-seam S-curve look without copying
 * Adidas's trademarked artwork — it's a generic 4-panel ball using the same
 * colour palette.
 *
 * Panel maths: two S-curves cross at the ball's centre (16,16).
 *   Vertical seam   M16,1  C19,4.5  17.5,10.25  16,16  C14.5,21.75 13,27.5  16,31
 *   Horizontal seam M1,16  C4.5,13  10.25,14.5  16,16  C21.75,17.5 27.5,19  31,16
 * Each panel is bounded by one seam half + one 90° arc of the ball edge.
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  const uid = useId().replace(/:/g, '')
  const clip = `c${uid}`
  const grad = `g${uid}`

  return (
    <svg
      width={px[size]}
      height={px[size]}
      viewBox="0 0 32 32"
      className={cn('animate-spin', className)}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
        {/* Sphere lighting: bright highlight top-left → subtle shadow bottom-right */}
        <radialGradient id={grad} cx="38%" cy="32%" r="58%">
          <stop offset="0%"   stopColor="white" stopOpacity="0.42" />
          <stop offset="100%" stopColor="black" stopOpacity="0.14" />
        </radialGradient>
      </defs>

      {/* ── Panels ──────────────────────────────────────────────── */}

      {/* Top-left — white (neutral) */}
      <path
        d="M16,16 C10.25,14.5 4.5,13 1,16 A15,15 0 0,1 16,1 C19,4.5 17.5,10.25 16,16 Z"
        fill="#F0F0F0"
        clipPath={`url(#${clip})`}
      />

      {/* Top-right — red (USA · Canada) */}
      <path
        d="M16,16 C17.5,10.25 19,4.5 16,1 A15,15 0 0,1 31,16 C27.5,19 21.75,17.5 16,16 Z"
        fill="#E8272B"
        clipPath={`url(#${clip})`}
      />

      {/* Bottom-right — blue (USA) */}
      <path
        d="M16,16 C21.75,17.5 27.5,19 31,16 A15,15 0 0,1 16,31 C13,27.5 14.5,21.75 16,16 Z"
        fill="#003DA5"
        clipPath={`url(#${clip})`}
      />

      {/* Bottom-left — green (Mexico) */}
      <path
        d="M16,16 C14.5,21.75 13,27.5 16,31 A15,15 0 0,1 1,16 C10.25,14.5 4.5,13 16,16 Z"
        fill="#007A33"
        clipPath={`url(#${clip})`}
      />

      {/* ── Seam lines ──────────────────────────────────────────── */}

      <path
        d="M16,1 C19,4.5 17.5,10.25 16,16 C14.5,21.75 13,27.5 16,31"
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.7"
        clipPath={`url(#${clip})`}
      />
      <path
        d="M1,16 C4.5,13 10.25,14.5 16,16 C21.75,17.5 27.5,19 31,16"
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="0.7"
        clipPath={`url(#${clip})`}
      />

      {/* ── Sphere shading ──────────────────────────────────────── */}
      <circle cx="16" cy="16" r="15" fill={`url(#${grad})`} clipPath={`url(#${clip})`} />

      {/* ── Ball outline ────────────────────────────────────────── */}
      <circle cx="16" cy="16" r="15" fill="none" stroke="#BBBBBB" strokeWidth="0.8" />
    </svg>
  )
}
