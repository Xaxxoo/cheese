'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Country {
  name: string
  flag: string
  dialCode: string
  code: string
}

// African countries first (primary market), then diaspora destinations
const COUNTRIES: Country[] = [
  { name: 'Nigeria',        code: 'NG', dialCode: '+234', flag: '🇳🇬' },
  { name: 'Ghana',          code: 'GH', dialCode: '+233', flag: '🇬🇭' },
  { name: 'Kenya',          code: 'KE', dialCode: '+254', flag: '🇰🇪' },
  { name: 'South Africa',   code: 'ZA', dialCode: '+27',  flag: '🇿🇦' },
  { name: 'Uganda',         code: 'UG', dialCode: '+256', flag: '🇺🇬' },
  { name: 'Tanzania',       code: 'TZ', dialCode: '+255', flag: '🇹🇿' },
  { name: 'Rwanda',         code: 'RW', dialCode: '+250', flag: '🇷🇼' },
  { name: 'Ethiopia',       code: 'ET', dialCode: '+251', flag: '🇪🇹' },
  { name: 'Senegal',        code: 'SN', dialCode: '+221', flag: '🇸🇳' },
  { name: 'Ivory Coast',    code: 'CI', dialCode: '+225', flag: '🇨🇮' },
  { name: 'Cameroon',       code: 'CM', dialCode: '+237', flag: '🇨🇲' },
  { name: 'Egypt',          code: 'EG', dialCode: '+20',  flag: '🇪🇬' },
  { name: 'Morocco',        code: 'MA', dialCode: '+212', flag: '🇲🇦' },
  { name: 'Zambia',         code: 'ZM', dialCode: '+260', flag: '🇿🇲' },
  { name: 'Zimbabwe',       code: 'ZW', dialCode: '+263', flag: '🇿🇼' },
  { name: 'Mozambique',     code: 'MZ', dialCode: '+258', flag: '🇲🇿' },
  { name: 'Botswana',       code: 'BW', dialCode: '+267', flag: '🇧🇼' },
  { name: 'Namibia',        code: 'NA', dialCode: '+264', flag: '🇳🇦' },
  { name: 'Angola',         code: 'AO', dialCode: '+244', flag: '🇦🇴' },
  { name: 'Benin',          code: 'BJ', dialCode: '+229', flag: '🇧🇯' },
  { name: 'Togo',           code: 'TG', dialCode: '+228', flag: '🇹🇬' },
  { name: 'Mali',           code: 'ML', dialCode: '+223', flag: '🇲🇱' },
  { name: 'Guinea',         code: 'GN', dialCode: '+224', flag: '🇬🇳' },
  { name: 'Sierra Leone',   code: 'SL', dialCode: '+232', flag: '🇸🇱' },
  { name: 'Liberia',        code: 'LR', dialCode: '+231', flag: '🇱🇷' },
  { name: 'Gambia',         code: 'GM', dialCode: '+220', flag: '🇬🇲' },
  { name: 'Malawi',         code: 'MW', dialCode: '+265', flag: '🇲🇼' },
  { name: 'Mauritius',      code: 'MU', dialCode: '+230', flag: '🇲🇺' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44',  flag: '🇬🇧' },
  { name: 'United States',  code: 'US', dialCode: '+1',   flag: '🇺🇸' },
  { name: 'Canada',         code: 'CA', dialCode: '+1',   flag: '🇨🇦' },
  { name: 'France',         code: 'FR', dialCode: '+33',  flag: '🇫🇷' },
  { name: 'Germany',        code: 'DE', dialCode: '+49',  flag: '🇩🇪' },
  { name: 'Italy',          code: 'IT', dialCode: '+39',  flag: '🇮🇹' },
  { name: 'Spain',          code: 'ES', dialCode: '+34',  flag: '🇪🇸' },
  { name: 'Netherlands',    code: 'NL', dialCode: '+31',  flag: '🇳🇱' },
  { name: 'Portugal',       code: 'PT', dialCode: '+351', flag: '🇵🇹' },
  { name: 'Ireland',        code: 'IE', dialCode: '+353', flag: '🇮🇪' },
  { name: 'Belgium',        code: 'BE', dialCode: '+32',  flag: '🇧🇪' },
  { name: 'Switzerland',    code: 'CH', dialCode: '+41',  flag: '🇨🇭' },
  { name: 'Sweden',         code: 'SE', dialCode: '+46',  flag: '🇸🇪' },
  { name: 'Norway',         code: 'NO', dialCode: '+47',  flag: '🇳🇴' },
  { name: 'Denmark',        code: 'DK', dialCode: '+45',  flag: '🇩🇰' },
  { name: 'Finland',        code: 'FI', dialCode: '+358', flag: '🇫🇮' },
  { name: 'Poland',         code: 'PL', dialCode: '+48',  flag: '🇵🇱' },
  { name: 'UAE',            code: 'AE', dialCode: '+971', flag: '🇦🇪' },
  { name: 'Saudi Arabia',   code: 'SA', dialCode: '+966', flag: '🇸🇦' },
  { name: 'Qatar',          code: 'QA', dialCode: '+974', flag: '🇶🇦' },
  { name: 'Kuwait',         code: 'KW', dialCode: '+965', flag: '🇰🇼' },
  { name: 'India',          code: 'IN', dialCode: '+91',  flag: '🇮🇳' },
  { name: 'China',          code: 'CN', dialCode: '+86',  flag: '🇨🇳' },
  { name: 'Brazil',         code: 'BR', dialCode: '+55',  flag: '🇧🇷' },
  { name: 'Australia',      code: 'AU', dialCode: '+61',  flag: '🇦🇺' },
]

// Try longest dial codes first to avoid prefix collisions (e.g. +27 vs +263)
const SORTED = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)

function parseValue(e164: string): { country: Country; local: string } {
  const country = SORTED.find(c => e164.startsWith(c.dialCode)) ?? COUNTRIES[0]
  const local = e164.startsWith(country.dialCode)
    ? e164.slice(country.dialCode.length)
    : ''
  return { country, local }
}

interface PhoneInputProps {
  label?: string
  value: string
  onChange: (v: string) => void
  error?: string
  hint?: string
}

export function PhoneInput({ label, value, onChange, error, hint }: PhoneInputProps) {
  const { country: initCountry, local: initLocal } = parseValue(value)
  const [country, setCountry]   = useState<Country>(initCountry)
  const [local, setLocal]       = useState(initLocal)
  const [open, setOpen]         = useState(false)
  const [search, setSearch]     = useState('')
  const [focused, setFocused]   = useState(false)
  const searchRef               = useRef<HTMLInputElement>(null)
  const wrapRef                 = useRef<HTMLDivElement>(null)

  // Focus search box when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [open])

  // Keep internal state in sync if parent resets value externally
  useEffect(() => {
    if (!value) {
      setLocal('')
      return
    }
    const { country: c, local: l } = parseValue(value)
    setCountry(c)
    setLocal(l)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function selectCountry(c: Country) {
    setCountry(c)
    setOpen(false)
    onChange(c.dialCode + local)
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^\d\s\-]/g, '')
    setLocal(v)
    onChange(country.dialCode + v)
  }

  const inputId = label?.toLowerCase().replace(/\s+/g, '-')

  const filtered = COUNTRIES.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  )

  const borderColor = focused
    ? error ? 'border-red-500/60' : 'border-[#d4a843]/60'
    : error ? 'border-red-500/40' : 'border-white/10'

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

      <div className="relative" ref={wrapRef}>
        <div className={cn('flex gap-2 items-stretch')}>
          {/* Country picker trigger */}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-12 rounded-2xl border transition-[border-color] duration-150',
              'text-sm text-white shrink-0 select-none',
              open ? 'border-[#d4a843]/60' : 'border-white/10',
            )}
            style={{ backgroundColor: '#191919' }}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-white/70 tabular-nums">{country.dialCode}</span>
            <ChevronDown
              size={13}
              className={cn('text-white/30 transition-transform duration-150', open && 'rotate-180')}
            />
          </button>

          {/* Local number input */}
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            placeholder="8012345678"
            value={local}
            onChange={handleLocalChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cn(
              'flex-1 h-12 border rounded-2xl px-4 text-sm text-white',
              'placeholder:text-white/20',
              'transition-[border-color] duration-150 focus:outline-none',
              borderColor,
            )}
            style={{
              backgroundColor: '#191919',
              WebkitTextFillColor: 'white',
              caretColor: 'white',
              colorScheme: 'dark',
            }}
            autoComplete="tel-national"
          />
        </div>

        {/* Dropdown panel */}
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl border border-white/10 overflow-hidden shadow-xl"
              style={{ backgroundColor: '#191919' }}
            >
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8">
                <Search size={13} className="text-white/30 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>

              {/* Country list */}
              <div className="max-h-52 overflow-y-auto overscroll-contain">
                {filtered.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-white/30">No results</p>
                ) : (
                  filtered.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => selectCountry(c)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
                        c.code === country.code
                          ? 'bg-[#d4a843]/10 text-white'
                          : 'text-white/70 hover:bg-white/5 active:bg-white/8',
                      )}
                    >
                      <span className="text-base leading-none shrink-0">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-white/35 tabular-nums text-xs shrink-0">{c.dialCode}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-white/35">{hint}</p>}
    </div>
  )
}
