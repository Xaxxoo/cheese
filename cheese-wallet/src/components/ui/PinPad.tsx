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
      <div className="flex gap-3">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-full border-2 transition-all duration-150',
              i < value.length
                ? 'bg-[#d4a843] border-[#d4a843]'
                : 'bg-transparent border-white/25',
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-400 -mt-2">{error}</p>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className={cn(
                'h-16 rounded-2xl text-xl font-medium transition-all duration-100',
                'active:scale-95 select-none',
                key === '⌫'
                  ? 'bg-transparent text-white/40 flex items-center justify-center'
                  : 'bg-white/8 border border-white/8 text-white hover:bg-white/12',
              )}
            >
              {key === '⌫' ? <Delete size={20} /> : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
