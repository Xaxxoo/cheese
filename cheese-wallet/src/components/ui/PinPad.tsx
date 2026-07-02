'use client'

import { cn } from '@/lib/cn'
import { Delete } from 'lucide-react'

interface PinPadProps {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  label?: string
  error?: string
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinPad({ value, onChange, maxLength = 6, label, error }: PinPadProps) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (value.length < maxLength) {
      onChange(value + key)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {label && (
        <p className="text-sm text-white/50 text-center">{label}</p>
      )}

      {/* Dots */}
      <div className="flex gap-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-3.5 h-3.5 rounded-full border-2 transition-all duration-200',
              i < value.length
                ? 'bg-[#d4a843] border-[#d4a843] shadow-[0_0_10px_rgba(212,168,67,0.5)]'
                : 'bg-transparent border-white/25',
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-400 -mt-2">{error}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3.5 w-full">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className={cn(
                'aspect-square rounded-full text-3xl font-medium transition-all duration-100',
                'flex items-center justify-center active:scale-[0.88] select-none',
                key === '⌫'
                  ? 'bg-transparent text-white/40'
                  : 'bg-white/8 border border-white/10 text-white hover:bg-white/12 active:bg-[#d4a843]/12 active:ring-2 active:ring-[#d4a843]/20',
              )}
            >
              {key === '⌫' ? <Delete size={24} /> : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
