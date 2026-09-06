'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  X, ArrowLeft, CheckCircle2, AlertCircle, AlertTriangle, Clock,
  AtSign, Wallet, ChevronRight, ChevronDown, Building2, ArrowUpRight, User, Layers, Search, Share2,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { PinPad } from '@/components/ui/PinPad'
import { useAuthStore } from '@/store/authStore'
import { useQueryClient } from '@tanstack/react-query'
import { resolveUsername, sendToUsername, sendToAddress, getExchangeRate, getSendFeeRate, getBanks, resolveAccount, bankTransfer, getBalance, getRecentRecipients } from '@/lib/api/wallet'
import { bridgeTransfer, getBridgeCountries, type BridgeCountry, type BridgeTransferResponse } from '@/lib/api/bridge'
import { resetPin as apiResetPin, setPin as apiSetPin } from '@/lib/api/auth'
import { signTransaction, signDeviceChallenge, hashPin } from '@/lib/crypto/deviceSigning'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import { captureAndShare, type ShareFormat } from '@/lib/shareReceipt'
import { playChaChing } from '@/lib/sound'
import confetti from 'canvas-confetti'
import type { BankTransferResponse, Transaction, NigerianBank, RecentRecipient } from '@/types'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type SendMode = 'username' | 'usdc' | 'bank'
type UsdcType = 'stellar' | 'evm'
type SendStep = 'mode' | 'usdc_network' | 'username_network' | 'recipient' | 'amount' | 'bank_details' | 'bank_amount' | 'bridge_details' | 'pin' | 'success' | 'error'

interface ResolvedRecipient {
  display: string
  address: string
  type: 'username' | 'address'
  raw: string
}

interface BankRecipient {
  bankCode: string
  bankName: string
  accountNumber: string
  accountName: string
}

const EVM_CHAINS = [
  { id: 'arbitrum',  label: 'Arbitrum',  free: true  },
  { id: 'base',      label: 'BASE',      free: false },
  { id: 'celo',      label: 'Celo',      free: false },
  { id: 'polygon',   label: 'Polygon',   free: false },
  { id: 'lisk',      label: 'Lisk',      free: false },
  { id: 'optimism',  label: 'Optimism',  free: false },
]

const NIGERIAN_BANKS = [
  'Access Bank', 'GTBank', 'First Bank', 'Zenith Bank', 'UBA',
  'Stanbic IBTC', 'Fidelity Bank', 'Sterling Bank', 'Union Bank',
  'Wema Bank', 'FCMB', 'Ecobank', 'Kuda Bank', 'OPay', 'Moniepoint',
]

const BANK_COUNTRIES = [
  { name: 'Nigeria', flag: '🇳🇬', code: 'NG', provider: 'pulsemfb' as const },
  { name: 'Kenya', flag: '🇰🇪', code: 'KE', provider: 'bridge' as const },
  { name: 'Ghana', flag: '🇬🇭', code: 'GH', provider: 'bridge' as const },
  { name: 'Rwanda', flag: '🇷🇼', code: 'RW', provider: 'bridge' as const },
  { name: 'Ethiopia', flag: '🇪🇹', code: 'ET', provider: 'bridge' as const },
]

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function isStellarAddress(s: string) {
  return /^G[A-Z0-9]{55}$/.test(s.trim())
}

function isEvmAddress(s: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(s.trim())
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function formatNgn(usdc: number, rate: number) {
  return (usdc * rate).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function getBankTransferFeeUsdc(amountNgn: number, effectiveRate: number): number {
  if (effectiveRate <= 0) return 0
  if (amountNgn < 10_000) return 200 / effectiveRate
  if (amountNgn < 50_000) return 500 / effectiveRate
  if (amountNgn < 100_000) return 0.8             // $0.80 flat
  if (amountNgn < 200_000) return 1            // $1 flat
  if (amountNgn <= 500_000) return 2            // $2 flat
  return 3                                      // $3 flat
}

function getMaxBankTransferNgn(usdcBalance: number, effectiveRate: number): number {
  if (usdcBalance <= 0 || effectiveRate <= 0) return 0

  // Total cost is monotonic even though the fee changes at tier boundaries,
  // so binary search finds the largest whole-naira amount that fits.
  let low = 0
  let high = 10_000_000
  while (low < high) {
    const candidate = Math.ceil((low + high) / 2)
    const total = candidate / effectiveRate + getBankTransferFeeUsdc(candidate, effectiveRate)
    if (total <= usdcBalance) low = candidate
    else high = candidate - 1
  }
  return low
}

// ─────────────────────────────────────────────────────────
// Mode Selector — first screen
// ─────────────────────────────────────────────────────────
function ModeSelector({ onSelect, onSelectBridge }: { onSelect: (mode: SendMode) => void; onSelectBridge: (countryCode: string) => void }) {
  const [crossBorderOpen, setCrossBorderOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const userCountry = user?.country ?? null
  const homeCountryInfo = userCountry ? BANK_COUNTRIES.find((c) => c.code === userCountry) : null
  const otherCountries = userCountry ? BANK_COUNTRIES.filter((c) => c.code !== userCountry) : BANK_COUNTRIES

  const modes = [
    {
      id: 'username' as SendMode,
      icon: <AtSign size={22} className="text-[#d4a843]" />,
      title: 'Send by Username',
      desc: 'Send USDC to another Cheese user',
    },
    {
      id: 'usdc' as SendMode,
      icon: <Wallet size={22} className="text-[#d4a843]" />,
      title: 'Send USDC',
      desc: 'Send to any Stellar wallet address',
    },
    {
      id: 'bank' as SendMode,
      icon: <Building2 size={22} className="text-[#d4a843]" />,
      title: 'Send to Bank',
      desc: homeCountryInfo ? `Cash out to ${homeCountryInfo.name} ${homeCountryInfo.flag}` : 'Choose a country and cash out locally',
    },
  ]

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-sm text-white/40 mb-2">How would you like to send?</p>
      {modes.map((m) => (
        <div key={m.id}>
          <button
          type="button"
          onClick={() => {
            if (m.id === 'bank') {
              if (homeCountryInfo) {
                // Default to user's own country
                if (homeCountryInfo.provider === 'pulsemfb') {
                  onSelect('bank')
                } else {
                  onSelectBridge(homeCountryInfo.code)
                }
              } else {
                // No country on file — expand country list
                setCrossBorderOpen((open) => !open)
              }
            } else {
              onSelect(m.id)
            }
          }}
          className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-150 text-left border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20"
        >
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-[#d4a843]/12">
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{m.title}</p>
            <p className="text-xs text-white/40 mt-0.5">{m.desc}</p>
          </div>
          {m.id === 'bank' && !homeCountryInfo
            ? <ChevronDown size={17} className={cn('text-white/25 shrink-0 transition-transform', crossBorderOpen && 'rotate-180')} />
            : <ChevronRight size={16} className="text-white/25 shrink-0" />}
          </button>

          {/* Cross-border option — shown when user has a home country */}
          {m.id === 'bank' && homeCountryInfo && (
            <>
              <button
                type="button"
                onClick={() => setCrossBorderOpen((open) => !open)}
                className="w-full flex items-center gap-3 px-4 py-2.5 mt-1 rounded-xl text-left text-xs font-medium text-[#d4a843]/80 hover:bg-white/5 transition-colors"
              >
                <ArrowUpRight size={14} className="text-[#d4a843]/60" />
                <span className="flex-1">Send to another country</span>
                <ChevronDown size={14} className={cn('text-white/25 transition-transform', crossBorderOpen && 'rotate-180')} />
              </button>
              {crossBorderOpen && (
                <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-hidden">
                  {otherCountries.map((country) => (
                    <button
                      key={country.name}
                      type="button"
                      onClick={() => {
                        setCrossBorderOpen(false)
                        if (country.provider === 'pulsemfb') {
                          onSelect('bank')
                        } else {
                          onSelectBridge(country.code)
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/75 hover:bg-white/8 transition-colors border-b border-white/5 last:border-0"
                    >
                      <span className="text-lg leading-none">{country.flag}</span>
                      <span className="flex-1">{country.name}</span>
                      <span className="text-[10px] text-white/30">Cross-border</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Country list fallback — shown when user has no country set */}
          {m.id === 'bank' && !homeCountryInfo && crossBorderOpen && (
          <div className="-mt-2 rounded-2xl border border-white/10 bg-[#141414] overflow-hidden">
            {otherCountries.map((country) => (
                <button
                  key={country.name}
                  type="button"
                  onClick={() => {
                    setCrossBorderOpen(false)
                    if (country.provider === 'pulsemfb') {
                      onSelect('bank')
                    } else {
                      onSelectBridge(country.code)
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-white/75 hover:bg-white/8 transition-colors border-b border-white/5 last:border-0"
                >
                  <span className="text-lg leading-none">{country.flag}</span>
                  <span className="flex-1">{country.name}</span>
                  <span className="text-[10px] text-white/30">Available</span>
                </button>
            ))}
          </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// USDC Network selector (Stellar vs Celo) — with balances
// ─────────────────────────────────────────────────────────
function UsdcNetworkStep({
  onStellar,
  onEvm,
  heading = 'Choose USDC network',
}: {
  onStellar: () => void
  onEvm: (chain: string) => void
  heading?: string
}) {
  const autoSkipped = useRef(false)

  const { data: balance, isLoading } = useQuery({
    queryKey: QUERY_KEYS.BALANCE,
    queryFn:  getBalance,
    staleTime: STALE_TIMES.BALANCE,
  })

  const stellarBal = parseFloat(balance?.stellarUsdc ?? '0')
  const celoBal    = parseFloat(balance?.evmUsdc ?? '0')

  // Auto-skip when only one chain has balance
  useEffect(() => {
    if (isLoading || autoSkipped.current) return
    const hasStellar = stellarBal > 0
    const hasCelo    = celoBal > 0
    if (hasStellar && !hasCelo) {
      autoSkipped.current = true
      onStellar()
    } else if (hasCelo && !hasStellar) {
      autoSkipped.current = true
      onEvm('celo')
    }
  }, [isLoading, stellarBal, celoBal, onStellar, onEvm])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-white/40">Loading balances…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-sm text-white/40 mb-1">{heading}</p>

      {/* Stellar card */}
      <button
        type="button"
        onClick={onStellar}
        disabled={stellarBal <= 0}
        className={cn(
          'flex items-center gap-4 p-4 rounded-2xl border transition-all text-left',
          stellarBal > 0
            ? 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
            : 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed',
        )}
      >
        <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/12 flex items-center justify-center shrink-0">
          <Wallet size={22} className="text-[#d4a843]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Stellar USDC</p>
          <p className="text-xs text-white/40 mt-0.5">
            ${stellarBal.toFixed(2)} available
          </p>
        </div>
        <ChevronRight size={16} className="text-white/25 shrink-0" />
      </button>

      {/* Celo card */}
      <button
        type="button"
        onClick={() => onEvm('celo')}
        disabled={celoBal <= 0}
        className={cn(
          'flex items-center gap-4 p-4 rounded-2xl border transition-all text-left',
          celoBal > 0
            ? 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
            : 'border-white/5 bg-white/2 opacity-50 cursor-not-allowed',
        )}
      >
        <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/12 flex items-center justify-center shrink-0">
          <Layers size={22} className="text-[#d4a843]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Celo</p>
          <p className="text-xs text-white/40 mt-0.5">
            ${celoBal.toFixed(2)} available
          </p>
        </div>
        <ChevronRight size={16} className="text-white/25 shrink-0" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// EVM address input
// ─────────────────────────────────────────────────────────
function EvmAddressInput({
  value,
  onChange,
  onResolved,
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  onResolved: (r: ResolvedRecipient | null) => void
  onClear: () => void
}) {
  const valid = isEvmAddress(value)

  useEffect(() => {
    if (valid) {
      onResolved({
        display: `${value.slice(0, 6)}…${value.slice(-4)}`,
        address: value.trim(),
        type: 'address',
        raw: value.trim(),
      })
    } else {
      onResolved(null)
    }
  }, [value, valid, onResolved])

  return (
    <div>
      <div className={cn(
        'flex items-center gap-3 min-h-14 px-4 py-3 rounded-2xl border transition-all duration-150 bg-white/6',
        valid             ? 'border-emerald-500/40' :
        value.length > 10 ? 'border-red-500/30'     :
        'border-white/10 focus-within:border-[#d4a843]/50',
      )}>
        <Layers size={17} className="text-white/30 shrink-0 mt-0.5" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
          placeholder="0x… EVM address"
          rows={2}
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none resize-none font-mono leading-relaxed"
        />
        {valid && <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
        {value && (
          <button type="button" onClick={onClear} className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        )}
      </div>
      {value.length > 10 && !valid && (
        <p className="text-xs text-red-400 mt-1.5 px-1">Enter a valid EVM address (starts with 0x…)</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Username input with live resolution
// ─────────────────────────────────────────────────────────
function UsernameInput({
  value,
  onChange,
  onResolved,
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  onResolved: (r: ResolvedRecipient | null) => void
  onClear: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookup = useCallback(async (raw: string) => {
    const name = raw.replace(/^@/, '').trim()
    if (name.length < 2) { setStatus('idle'); onResolved(null); return }
    setStatus('searching')
    try {
      const result = await resolveUsername(name)
      setStatus('found')
      onResolved({ display: `@${name}`, address: result.address, type: 'username', raw })
    } catch {
      setStatus('not_found')
      onResolved(null)
    }
  }, [onResolved])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value) { setStatus('idle'); onResolved(null); return }
    debounceRef.current = setTimeout(() => lookup(value), 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, lookup, onResolved])

  return (
    <div>
      <div className={cn(
        'flex items-center gap-3 h-14 px-4 rounded-2xl border transition-all duration-150 bg-white/6',
        status === 'found'     ? 'border-emerald-500/40' :
        status === 'not_found' ? 'border-red-500/30'     :
        'border-white/10 focus-within:border-[#d4a843]/50',
      )}>
        <AtSign size={17} className="text-white/30 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, '').toLowerCase())}
          placeholder="username"
          autoFocus
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
        />
        {status === 'searching' && <Spinner size="sm" />}
        {status === 'found'     && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
        {status === 'not_found' && <AlertCircle  size={16} className="text-red-400 shrink-0" />}
        {value && status !== 'searching' && (
          <button type="button" onClick={onClear} className="text-white/25 hover:text-white/50 transition-colors shrink-0">
            <X size={16} />
          </button>
        )}
      </div>
      {status === 'not_found' && (
        <p className="text-xs text-red-400 mt-1.5 px-1">No user found with that username</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stellar address input — with USDC trustline check
// ─────────────────────────────────────────────────────────
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

type TrustlineStatus = 'idle' | 'checking' | 'ok' | 'no_trustline' | 'no_account'

function AddressInput({
  value,
  onChange,
  onResolved,
  onClear,
}: {
  value: string
  onChange: (v: string) => void
  onResolved: (r: ResolvedRecipient | null) => void
  onClear: () => void
}) {
  const [trustlineStatus, setTrustlineStatus] = useState<TrustlineStatus>('idle')
  const valid = isStellarAddress(value)

  useEffect(() => {
    if (!valid) {
      setTrustlineStatus('idle')
      onResolved(null)
      return
    }

    const addr = value.trim()
    let cancelled = false
    setTrustlineStatus('checking')
    onResolved(null) // block progression until check passes

    void (async () => {
      try {
        const res = await fetch(`https://horizon.stellar.org/accounts/${addr}`)
        if (cancelled) return

        if (res.status === 404) {
          setTrustlineStatus('no_account')
          return
        }

        if (!res.ok) {
          // Unknown Horizon error — pass through; backend will guard
          setTrustlineStatus('ok')
          onResolved({ display: truncateAddress(addr), address: addr, type: 'address', raw: addr })
          return
        }

        const data = await res.json() as {
          balances: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>
        }
        const hasTrustline = data.balances?.some(
          (b) => b.asset_type === 'credit_alphanum4' &&
                 b.asset_code === 'USDC' &&
                 b.asset_issuer === USDC_ISSUER_MAINNET
        ) ?? false

        if (cancelled) return

        if (hasTrustline) {
          setTrustlineStatus('ok')
          onResolved({ display: truncateAddress(addr), address: addr, type: 'address', raw: addr })
        } else {
          setTrustlineStatus('no_trustline')
        }
      } catch {
        if (cancelled) return
        // Network failure — don't block; backend will guard
        setTrustlineStatus('ok')
        onResolved({ display: truncateAddress(addr), address: addr, type: 'address', raw: addr })
      }
    })()

    return () => { cancelled = true }
  }, [value, valid, onResolved])

  return (
    <div>
      <div className={cn(
        'flex items-center gap-3 min-h-14 px-4 py-3 rounded-2xl border transition-all duration-150 bg-white/6',
        trustlineStatus === 'ok'                                               ? 'border-emerald-500/40' :
        trustlineStatus === 'no_trustline' || trustlineStatus === 'no_account' ? 'border-red-500/30'     :
        value.length > 10 && !valid                                            ? 'border-red-500/30'     :
        'border-white/10 focus-within:border-[#d4a843]/50',
      )}>
        <Wallet size={17} className="text-white/30 shrink-0 mt-0.5" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))}
          placeholder="G… Stellar address"
          rows={2}
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none resize-none font-mono leading-relaxed"
        />
        {trustlineStatus === 'checking'    && <Spinner size="sm" />}
        {trustlineStatus === 'ok'          && <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
        {(trustlineStatus === 'no_trustline' || trustlineStatus === 'no_account') && (
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
        )}
        {value && trustlineStatus !== 'checking' && (
          <button type="button" onClick={onClear} className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        )}
      </div>

      {value.length > 10 && !valid && (
        <p className="text-xs text-red-400 mt-1.5 px-1">Enter a valid Stellar address (starts with G…)</p>
      )}
      {trustlineStatus === 'no_account' && (
        <p className="text-xs text-red-400 mt-1.5 px-1">
          This account doesn't exist on Stellar yet — the recipient must activate their wallet first.
        </p>
      )}
      {trustlineStatus === 'no_trustline' && (
        <p className="text-xs text-red-400 mt-1.5 px-1 leading-relaxed">
          This account isn't set up to receive USDC. The recipient needs to add a USDC trustline in their Stellar wallet.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bank details step (combined with amount entry)
// ─────────────────────────────────────────────────────────
function BankDetailsStep({
  onNext,
  recentBankRecipients,
}: {
  onNext: (recipient: BankRecipient, amountNgn: string) => void
  recentBankRecipients: RecentRecipient[]
}) {
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null)
  const [acctNum, setAcctNum]           = useState('')
  const [acctName, setAcctName]         = useState('')
  const [nameUnverified, setNameUnverified] = useState(false)
  const [verifying, setVerifying]       = useState(false)
  const [verified, setVerified]         = useState(false)
  const [bankOpen, setBankOpen]         = useState(false)
  const [bankQuery, setBankQuery]       = useState('')
  const [verifyError, setVerifyError]   = useState('')
  const [amountRaw, setAmountRaw]       = useState('')
  const [amountError, setAmountError]   = useState('')
  const verifyRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const banksQ = useQuery({
    queryKey: QUERY_KEYS.BANKS,
    queryFn:  getBanks,
    staleTime: STALE_TIMES.BANKS,
  })
  const banks: NigerianBank[] = banksQ.data ?? []

  const balanceQ = useQuery({
    queryKey: QUERY_KEYS.BALANCE,
    queryFn:  getBalance,
    staleTime: STALE_TIMES.BALANCE,
  })
  const rateQ = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })
  const usdcBalance = parseFloat(balanceQ.data?.totalUsdc ?? '0')
  const effectiveRate = rateQ.data ? parseFloat(rateQ.data.effectiveRate) : 0
  const maxNgn = getMaxBankTransferNgn(usdcBalance, effectiveRate)

  function handleAcctNum(v: string) {
    const clean = v.replace(/\D/g, '').slice(0, 10)
    setAcctNum(clean)
    setVerified(false)
    setAcctName('')
    setNameUnverified(false)
    setVerifyError('')
    setAmountRaw('')
    setAmountError('')
  }

  // Auto-verify when 10 digits entered and bank is selected
  useEffect(() => {
    if (acctNum.length !== 10 || !selectedBank || verified) return
    let cancelled = false
    if (verifyRef.current) clearTimeout(verifyRef.current)
    verifyRef.current = setTimeout(async () => {
      setVerifying(true)
      setVerifyError('')
      try {
        const result = await resolveAccount({ bankCode: selectedBank.code, accountNumber: acctNum })
        if (cancelled) return
        if (result.verified && result.accountName) {
          setVerified(true)
          setAcctName(result.accountName)
          setNameUnverified(false)
          return
        }

        setVerified(false)
        setAcctName('')
        setNameUnverified(false)
        setVerifyError('Could not verify this account. Confirm the bank and account number and try again.')
      } catch (err) {
        if (cancelled) return
        setVerified(false)
        setAcctName('')
        setNameUnverified(false)
        setVerifyError((err as Error).message ?? 'Could not verify account')
      } finally {
        if (!cancelled) setVerifying(false)
      }
    }, 800)
    return () => {
      cancelled = true
      if (verifyRef.current) clearTimeout(verifyRef.current)
    }
  }, [acctNum, selectedBank, verified])

  function handleSelectRecentBank(r: RecentRecipient) {
    const bank = banks.find((b) => b.name === r.bankName) ?? null
    if (bank && r.accountNumber) {
      setSelectedBank(bank)
      setAcctNum(r.accountNumber)
      setAcctName(r.recipientName ?? '')
      setVerified(true)
      setNameUnverified(!r.recipientName)
      setBankOpen(false)
      setBankQuery('')
      setVerifyError('')
    }
  }

  function handleAmountInput(v: string) {
    const raw = v.replace(/\D/g, '')
    setAmountRaw(raw)
    const parsed   = parseInt(raw, 10) || 0
    const parsedFee   = parsed >= 100 ? getBankTransferFeeUsdc(parsed, effectiveRate) : 0
    const parsedTotal = effectiveRate > 0 && parsed > 0 ? parsed / effectiveRate + parsedFee : 0
    if (usdcBalance > 0 && parsedTotal > 0 && parsedTotal > usdcBalance) {
      setAmountError(`Insufficient balance — available: ₦${Math.floor(maxNgn).toLocaleString('en-NG')}`)
    } else {
      setAmountError('')
    }
  }

  const amount         = parseInt(amountRaw, 10) || 0
  const feeUsdcAmount  = amount >= 100 ? getBankTransferFeeUsdc(amount, effectiveRate) : 0
  const totalUsdc      = effectiveRate > 0 && amount > 0 ? amount / effectiveRate + feeUsdcAmount : 0
  const overBalance    = usdcBalance > 0 && totalUsdc > 0 && totalUsdc > usdcBalance
  const canConfirm = verified && !!acctName && !!selectedBank && amount >= 100 && !overBalance

  function handleConfirm() {
    if (!selectedBank || !acctName) return
    if (!amount || amount <= 0) { setAmountError('Enter an amount'); return }
    if (amount < 100)           { setAmountError('Minimum is ₦100'); return }
    if (overBalance) {
      setAmountError(`Insufficient balance — available: ₦${Math.floor(maxNgn).toLocaleString('en-NG')}`)
      return
    }
    onNext(
      { bankCode: selectedBank.code, bankName: selectedBank.name, accountNumber: acctNum, accountName: acctName },
      amountRaw,
    )
  }

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Recent bank recipients */}
      {recentBankRecipients.length > 0 && !verified && (
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Recent</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {recentBankRecipients.map((r, i) => (
              <button
                key={`${r.bankName}-${r.accountNumber}-${i}`}
                type="button"
                onClick={() => handleSelectRecentBank(r)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/15 transition-all text-left shrink-0"
              >
                <Building2 size={12} className="text-[#d4a843] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate max-w-[7rem]">{r.recipientName ?? r.accountNumber}</p>
                  <p className="text-[10px] text-white/35 truncate max-w-[7rem]">{r.bankName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bank selector */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Bank</p>
        <div className="relative">
          <div className={cn(
            'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
            bankOpen ? 'border-[#d4a843]/50' : selectedBank ? 'border-white/15' : 'border-white/10',
          )}>
            <Building2 size={17} className="text-white/30 shrink-0" />
            <input
              type="text"
              value={bankOpen ? bankQuery : (selectedBank?.name ?? '')}
              onChange={(e) => { setBankOpen(true); setBankQuery(e.target.value) }}
              onFocus={() => { setBankOpen(true); setBankQuery('') }}
              onBlur={() => setTimeout(() => setBankOpen(false), 150)}
              placeholder={banksQ.isLoading ? 'Loading banks…' : 'Search for bank…'}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
            {selectedBank && !bankOpen
              ? <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSelectedBank(null)
                    setBankQuery('')
                    setBankOpen(true)
                  }}
                  className="text-white/25 hover:text-white/50 transition-colors"
                >
                  <X size={14} />
                </button>
              : <Search size={15} className="text-white/25 shrink-0" />
            }
          </div>
          {bankOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-[#141414] border border-white/10 rounded-2xl overflow-hidden z-10 max-h-56 overflow-y-auto">
              {(() => {
                const filtered = bankQuery.trim()
                  ? banks.filter((b) => b.name.toLowerCase().includes(bankQuery.toLowerCase()))
                  : banks
                return filtered.length === 0
                  ? <p className="px-4 py-5 text-sm text-white/30 text-center">No banks found</p>
                  : filtered.map((b) => (
                      <button
                        key={b.code}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setSelectedBank(b)
                          setBankOpen(false)
                          setBankQuery('')
                          setVerified(false)
                          setAcctName('')
                          setNameUnverified(false)
                          setAmountRaw('')
                          setAmountError('')
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors border-b border-white/5 last:border-0"
                      >
                        {b.name}
                      </button>
                    ))
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Account number */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Account Number</p>
        <div className={cn(
          'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
          verified  ? 'border-emerald-500/40' :
          verifying ? 'border-[#d4a843]/30'   :
          'border-white/10 focus-within:border-[#d4a843]/50',
        )}>
          <input
            type="text"
            inputMode="numeric"
            value={acctNum}
            onChange={(e) => handleAcctNum(e.target.value)}
            placeholder="10-digit account number"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none font-mono tracking-widest"
            maxLength={10}
          />
          {verifying
            ? <Spinner size="sm" />
            : verified
            ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            : <span className="text-xs text-white/25 shrink-0">{acctNum.length}/10</span>
          }
        </div>
      </div>

      {/* Verify error */}
      {verifyError && (
        <p className="text-xs text-red-400 text-center">{verifyError}</p>
      )}

      {/* ── Case 1: name auto-resolved by the API ── */}
      {verified && !nameUnverified && acctName && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <User size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-emerald-400/70 mb-0.5">Account name</p>
            <p className="text-base font-semibold text-white">{acctName}</p>
            <p className="text-xs text-white/35 mt-0.5 font-mono">{acctNum} · {selectedBank?.name}</p>
          </div>
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        </div>
      )}

      {/* ── Case 2: API couldn't fetch name (most external banks) ──
           Show a "account accepted" card, then a name field for the user to fill */}
      {verified && nameUnverified && (
        <div className="flex flex-col gap-3">
          {/* Confirmed card — bank + account number */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#d4a843]/6 border border-[#d4a843]/20">
            <div className="w-10 h-10 rounded-full bg-[#d4a843]/12 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-[#d4a843]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#d4a843]/60 mb-0.5">Account accepted</p>
              <p className="text-sm font-semibold text-white">{selectedBank?.name}</p>
              <p className="text-xs text-white/40 font-mono mt-0.5">{acctNum}</p>
            </div>
            <CheckCircle2 size={18} className="text-[#d4a843] shrink-0" />
          </div>

          {/* Name field */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">
              Recipient Name
            </p>
            <div className={cn(
              'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-[border-color] duration-150',
              acctName ? 'border-emerald-500/40' : 'border-white/10 focus-within:border-[#d4a843]/50',
            )}>
              <User size={15} className="text-white/30 shrink-0" />
              <input
                type="text"
                value={acctName}
                onChange={(e) => setAcctName(e.target.value.toUpperCase())}
                placeholder="ACCOUNT HOLDER NAME"
                autoFocus
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/20 outline-none tracking-wide"
                autoCapitalize="characters"
                spellCheck={false}
              />
              {acctName.length > 2 && (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              )}
            </div>
            <p className="text-xs text-white/30 mt-1.5 px-1">
              Enter the name exactly as it appears on the bank account
            </p>
          </div>
        </div>
      )}

      {/* Amount input — shown as soon as account is verified, regardless of name resolution */}
      {verified && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Amount</p>
            {balanceQ.data && (
              <p className={cn('text-xs', overBalance ? 'text-red-400' : 'text-white/30')}>
                Maximum: ₦{maxNgn.toLocaleString('en-NG')}
              </p>
            )}
          </div>
          <div className={cn(
            'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
            overBalance || amountError ? 'border-red-500/40'   :
            amount >= 100             ? 'border-[#d4a843]/40' :
            'border-white/10 focus-within:border-[#d4a843]/50',
          )}>
            <span className="text-white/30 text-sm font-medium shrink-0">₦</span>
            <input
              type="text"
              inputMode="numeric"
              value={amountRaw}
              onChange={(e) => handleAmountInput(e.target.value)}
              placeholder="Enter amount"
              autoFocus={!nameUnverified}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
            />
            {amount >= 100 && !overBalance && (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            )}
          </div>

          <p className="text-xs text-white/35 mt-2">
            Maximum you can withdraw: <span className="text-[#d4a843]">₦{maxNgn.toLocaleString('en-NG')}</span> (fee included)
          </p>

          {/* Quick-select preset amounts */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setAmountRaw(String(maxNgn)); setAmountError('') }}
              disabled={maxNgn < 100}
              className={cn(
                'col-span-3 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                maxNgn >= 100
                  ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843] hover:bg-[#d4a843]/20'
                  : 'bg-white/2 border-white/5 text-white/20 cursor-not-allowed',
              )}
            >
              Withdraw maximum · ₦{maxNgn.toLocaleString('en-NG')}
            </button>
            {[500, 1000, 2000, 5000, 10000, 20000].map((preset) => {
              const exceedsBalance = maxNgn > 0 && preset > maxNgn
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmountRaw(String(preset))
                    if (exceedsBalance) {
                      setAmountError(`Insufficient balance — available: ₦${Math.floor(maxNgn).toLocaleString('en-NG')}`)
                    } else {
                      setAmountError('')
                    }
                  }}
                  className={cn(
                    'py-2.5 rounded-xl border text-sm font-medium transition-colors',
                    exceedsBalance
                      ? 'bg-white/2 border-white/5 text-white/20 cursor-not-allowed'
                      : amountRaw === String(preset)
                      ? 'bg-[#d4a843]/15 border-[#d4a843]/40 text-[#d4a843]'
                      : 'bg-white/4 border-white/8 text-white/50 hover:bg-white/8 hover:text-white/80',
                  )}
                >
                  ₦{preset.toLocaleString('en-NG')}
                </button>
              )
            })}
          </div>

          {amountError && (
            <p className="text-xs text-red-400 mt-2 px-1">{amountError}</p>
          )}
          {amountRaw && amount > 0 && amount < 100 && !amountError && (
            <p className="text-xs text-amber-400 mt-2 px-1">Minimum transfer is ₦100</p>
          )}

          {amount >= 100 && !amountError && totalUsdc > 0 && (
            <div className="rounded-2xl bg-white/4 border border-white/6 px-4 py-3 mt-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">You send</span>
                <span className="text-white/70">₦{amount.toLocaleString('en-NG')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Cheese fee</span>
                <span className="text-white/50">${feeUsdcAmount.toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between text-xs border-t border-white/6 pt-1.5">
                <span className="text-white/40">Total deducted</span>
                <span className="text-white font-medium">${totalUsdc.toFixed(4)} USDC</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto">
        <Button
          fullWidth
          size="lg"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          Confirm
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bank amount step
// ─────────────────────────────────────────────────────────
function BankAmountStep({
  recipient,
  onBack,
  onNext,
}: {
  recipient: BankRecipient
  onBack: () => void
  onNext: (amountNgn: string) => void
}) {
  const [raw, setRaw]     = useState('')
  const [error, setError] = useState('')
  const amount = parseInt(raw, 10) || 0

  const { data: rate } = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })
  const { data: balance } = useQuery({
    queryKey: QUERY_KEYS.BALANCE,
    queryFn:  getBalance,
    staleTime: STALE_TIMES.BALANCE,
    retry: 1,
  })

  const effectiveRate = rate ? parseFloat(rate.effectiveRate) : 0
  const usdcNeeded    = effectiveRate > 0 ? amount / effectiveRate : 0
  const usdcBalance   = balance ? parseFloat(balance.totalUsdc) : null

  function handleInput(v: string) {
    setRaw(v.replace(/\D/g, ''))
    setError('')
  }

  function submit() {
    if (!amount || amount <= 0) { setError('Enter an amount'); return }
    if (amount < 100)           { setError('Minimum is ₦100'); return }
    if (usdcBalance !== null && effectiveRate > 0 && usdcBalance < usdcNeeded) {
      setError(`Insufficient balance — need $${usdcNeeded.toFixed(4)} USDC, you have $${usdcBalance.toFixed(4)}`)
      return
    }
    onNext(raw)
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Recipient chip */}
      <button type="button" onClick={onBack} className="flex items-center gap-2 mb-6 group w-fit">
        <div className="w-8 h-8 rounded-full bg-[#d4a843]/15 flex items-center justify-center">
          <Building2 size={14} className="text-[#d4a843]" />
        </div>
        <span className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">
          {recipient.accountName}
        </span>
        <X size={13} className="text-white/25 group-hover:text-white/50 transition-colors" />
      </button>

      {/* Big amount input */}
      <div className="flex flex-col items-center gap-2 flex-1 justify-center -mt-8">
        <div className="flex items-center">
          <span className="text-4xl font-light text-white/30 mr-1 mt-1">₦</span>
          <input
            type="text"
            inputMode="numeric"
            value={raw}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="0"
            autoFocus
            className={cn(
              'text-5xl font-semibold bg-transparent outline-none text-center',
              'placeholder:text-white/15',
              raw ? 'text-white' : 'text-white/20',
            )}
            style={{ width: `${Math.max(2, (raw || '0').length)}ch` }}
          />
        </div>
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        {!error && amount >= 100 && usdcNeeded > 0 && (
          <p className="text-xs text-white/30 text-center">
            ≈ ${usdcNeeded.toFixed(4)} USDC
          </p>
        )}
      </div>

      <Button fullWidth size="lg" onClick={submit} disabled={!amount || amount <= 0}>
        Continue
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Amount step (USDC flows)
// ─────────────────────────────────────────────────────────
function AmountStep({
  recipient,
  onBack,
  onNext,
}: {
  recipient: ResolvedRecipient
  onBack: () => void
  onNext: (amount: string) => void
}) {
  const [raw, setRaw]     = useState('')
  const [error, setError] = useState('')

  const { data: rate } = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })

  const { data: feeData } = useQuery({
    queryKey: QUERY_KEYS.SEND_FEE_RATE,
    queryFn:  getSendFeeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })

  const amount         = parseFloat(raw) || 0
  const ngnRate        = rate ? parseFloat(rate.effectiveRate) : 0
  const ngnEq          = amount > 0 && ngnRate > 0 ? formatNgn(amount, ngnRate) : null
  const feeRate        = feeData?.feeRate ?? 0.001
  const feeUsdc        = amount > 0 ? amount * feeRate : 0
  const netToRecipient = amount > 0 ? amount - feeUsdc : 0

  function handleInput(v: string) {
    const clean = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setRaw(clean)
    setError('')
  }

  function submit() {
    if (!amount || amount <= 0) { setError('Enter an amount'); return }
    if (amount < 0.01)          { setError('Minimum is $0.01 USDC'); return }
    onNext(amount.toFixed(6))
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Recipient chip */}
      <button type="button" onClick={onBack} className="flex items-center gap-2 mb-6 group w-fit">
        <div className="w-8 h-8 rounded-full bg-[#d4a843]/15 flex items-center justify-center">
          {recipient.type === 'username'
            ? <AtSign size={14} className="text-[#d4a843]" />
            : <Wallet  size={14} className="text-[#d4a843]" />}
        </div>
        <span className="text-sm text-white/70 font-medium group-hover:text-white transition-colors">
          {recipient.display}
        </span>
        <X size={13} className="text-white/25 group-hover:text-white/50 transition-colors" />
      </button>

      {/* Big amount input */}
      <div className="flex flex-col items-center gap-2 flex-1 justify-center -mt-8">
        <div className="flex items-center">
          <span className="text-4xl font-light text-white/30 mr-1 mt-1">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="0"
            autoFocus
            className={cn(
              'text-5xl font-semibold bg-transparent outline-none text-center',
              'placeholder:text-white/15',
              raw ? 'text-white' : 'text-white/20',
            )}
            style={{ width: `${Math.max(2, (raw || '0').length)}ch` }}
          />
        </div>

        {ngnEq && <p className="text-sm text-white/35">≈ ₦{ngnEq}</p>}
        {error  && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {amount > 0 && (
        <div className="rounded-2xl bg-white/4 border border-white/6 px-4 py-3 mb-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Fee ({feeData?.feePct ?? '…'})</span>
            <span className="text-white/50">${feeUsdc.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-xs border-t border-white/6 pt-1.5">
            <span className="text-white/40">Recipient gets</span>
            <span className="text-white font-medium">${netToRecipient.toFixed(4)} USDC</span>
          </div>
        </div>
      )}

      <Button fullWidth size="lg" onClick={submit} disabled={!amount || amount <= 0}>
        Continue
        <ChevronRight size={16} />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────
// "No PIN set" inline setup flow — shared by all PIN steps
// ─────────────────────────────────────────────────────────
function SetPinFlow({ onCancel }: { onCancel: () => void }) {
  const { user, updateUser } = useAuthStore()

  type Phase = 'new' | 'confirm'
  const [phase, setPhase]       = useState<Phase>('new')
  const [firstPin, setFirstPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Auto-advance when first PIN is complete
  useEffect(() => {
    if (phase === 'new' && firstPin.length === 6) {
      setPhase('confirm')
    }
  }, [firstPin, phase])

  // Auto-submit when confirm PIN is complete
  useEffect(() => {
    if (phase === 'confirm' && confirmPin.length === 6 && !loading) {
      void submit(confirmPin)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmPin, phase, loading])

  async function submit(confirmed: string) {
    if (confirmed !== firstPin) {
      setError("PINs don't match — try again")
      setConfirmPin('')
      setPhase('new')
      setFirstPin('')
      return
    }
    if (!user) { onCancel(); return }
    setLoading(true)
    setError('')
    try {
      const pinHash = await hashPin(confirmed, user.id)
      await apiSetPin(pinHash)
      updateUser({ hasPin: true })
      // parent re-renders with hasPin true → shows normal PIN pad automatically
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set PIN'
      setError(msg)
      setConfirmPin('')
      setPhase('new')
      setFirstPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {/* Explanation banner */}
      <div className="w-full rounded-2xl bg-amber-400/8 border border-amber-400/20 px-4 py-3.5 flex gap-2.5">
        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-200">No transaction PIN set</p>
          <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">
            You need a 6-digit transaction PIN to send money. Set one now to continue with this transfer.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Spinner size="lg" />
          <p className="text-sm text-white/40">Setting your PIN…</p>
        </div>
      ) : (
        <PinPad
          value={phase === 'new' ? firstPin : confirmPin}
          onChange={phase === 'new' ? setFirstPin : setConfirmPin}
          maxLength={6}
          label={phase === 'new' ? 'Choose a 6-digit transaction PIN' : 'Confirm your PIN'}
          error={error}
        />
      )}

      {!loading && (
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
        >
          <ArrowLeft size={14} />
          Go back
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PIN step — USDC flows
// ─────────────────────────────────────────────────────────
function PinStep({
  recipient,
  amount,
  network,
  onBack,
  onSuccess,
  onError,
}: {
  recipient: ResolvedRecipient
  amount: string
  network: string
  onBack: () => void
  onSuccess: (tx: Transaction) => void
  onError: (msg: string) => void
}) {
  const { user, deviceId } = useAuthStore()
  const queryClient             = useQueryClient()
  const [pin, setPin]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [pinError, setPinError] = useState('')
  const submittedRef            = useRef(false)

  const { data: rate } = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })

  const { data: feeData } = useQuery({
    queryKey: QUERY_KEYS.SEND_FEE_RATE,
    queryFn:  getSendFeeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })

  const ngnRate        = rate ? parseFloat(rate.effectiveRate) : 0
  const ngnEq          = parseFloat(amount) > 0 && ngnRate > 0
    ? formatNgn(parseFloat(amount), ngnRate) : null
  const feeRate        = feeData?.feeRate ?? 0.001
  const feeUsdc        = (parseFloat(amount) * feeRate).toFixed(4)
  const netToRecipient = (parseFloat(amount) - parseFloat(feeUsdc)).toFixed(4)

  const submit = useCallback(async (currentPin: string) => {
    if (submittedRef.current) return
    if (!user || !deviceId) { onError('Session expired — please log in again.'); return }

    submittedRef.current = true
    setLoading(true)
    setPinError('')

    try {
      // send.service.ts verifies the signature against just the deviceId string,
      // not the full canonical payload — use signDeviceChallenge accordingly.
      const [pinHash, deviceSignature] = await Promise.all([
        hashPin(currentPin, user.id),
        signDeviceChallenge(deviceId),
      ])

      const tx = recipient.type === 'username'
        ? await sendToUsername({
            username:        recipient.raw.replace(/^@/, ''),
            amountUsdc:      amount,
            pinHash,
            deviceSignature,
            deviceId,
            network,
          })
        : await sendToAddress({
            address:         recipient.address,
            amountUsdc:      amount,
            network,
            pinHash,
            deviceSignature,
            deviceId,
          })

      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BALANCE })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS(1) })
      onSuccess(tx)
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      if (msg.toLowerCase().includes('incorrect pin')) {
        setPinError('Incorrect PIN — try again')
        setPin('')
      } else {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [user, deviceId, queryClient, recipient, amount, network, onSuccess, onError])

  useEffect(() => {
    if (pin.length === 6 && !loading) {
      void submit(pin)
    }
  }, [pin, loading, submit])

  return (
    <div className="flex flex-col flex-1">
      {/* Summary card */}
      <div className="rounded-3xl border border-white/8 bg-white/4 p-5 mb-6">
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">To</span>
          <span className="text-sm text-white/80 font-medium">{recipient.display}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Network</span>
          <span className="text-sm text-white/80 font-medium">
            {EVM_CHAINS.find((c) => c.id === network)?.label ?? 'Stellar'}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">You send</span>
          <div className="text-right">
            <p className="text-base font-semibold text-white">
              ${parseFloat(amount).toFixed(2)} <span className="text-white/40 text-sm font-normal">USDC</span>
            </p>
            {ngnEq && <p className="text-xs text-white/30">≈ ₦{ngnEq}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Fee ({feeData?.feePct ?? '…'})</span>
          <span className="text-xs text-white/50">−${feeUsdc} USDC</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Recipient gets</span>
          <span className="text-sm font-semibold text-white">${netToRecipient} USDC</span>
        </div>
      </div>

      {/* Network warning */}
      <div className="flex gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 mb-2">
        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200/80 leading-relaxed">
          Make sure the recipient address is correct and supports{' '}
          <span className="font-semibold text-amber-300">
            {recipient.type === 'address'
              ? (EVM_CHAINS.find((c) => c.id === network)?.label ?? 'Stellar')
              : 'Cheese Pay'}
          </span>{' '}
          transfers. Crypto transactions cannot be reversed.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {!user?.hasPin ? (
          <SetPinFlow onCancel={onBack} />
        ) : loading ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-white/40">Processing transfer…</p>
          </div>
        ) : (
          <PinPad
            value={pin}
            onChange={setPin}
            maxLength={6}
            label="Enter your PIN to confirm"
            error={pinError}
          />
        )}
      </div>

      {user?.hasPin && !loading && (
        <div className="flex flex-col items-center gap-3 mt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
          >
            <ArrowLeft size={14} />
            Change amount
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PIN step — Bank transfer
// ─────────────────────────────────────────────────────────
function BankPinStep({
  recipient,
  amountNgn,
  onBack,
  onSuccess,
  onError,
}: {
  recipient: BankRecipient
  amountNgn: string
  onBack: () => void
  onSuccess: (result: BankTransferResponse) => void
  onError: (msg: string) => void
}) {
  const { user, deviceId, updateUser } = useAuthStore()
  const queryClient                     = useQueryClient()
  const [pin, setPin]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [pinError, setPinError] = useState('')
  const submittedRef            = useRef(false)

  const { data: rate } = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })
  const effectiveRate  = rate ? parseFloat(rate.effectiveRate) : 0
  const ngnAmount      = parseInt(amountNgn, 10)
  const feeUsdcAmount  = getBankTransferFeeUsdc(ngnAmount, effectiveRate)
  const totalUsdc      = effectiveRate > 0 ? ngnAmount / effectiveRate + feeUsdcAmount : 0

  // ── Forgot PIN reset flow ───────────────────────────────
  type ResetFlow = 'off' | 'new' | 'confirm'
  const [resetFlow, setResetFlow]   = useState<ResetFlow>('off')
  const [firstNewPin, setFirstNewPin] = useState('')
  const [resetPin, setResetPin]     = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const submitResetPin = useCallback(async (input: string) => {
    if (resetFlow === 'new') {
      setFirstNewPin(input)
      setResetPin('')
      setResetFlow('confirm')
      return
    }
    if (resetFlow === 'confirm') {
      if (input !== firstNewPin) {
        setPinError("PINs don't match — try again")
        setResetPin('')
        setResetFlow('new')
        setFirstNewPin('')
        return
      }
      if (!user) { onError('Session expired'); return }
      setResetLoading(true)
      try {
        await apiResetPin()
        const newHash = await hashPin(firstNewPin, user.id)
        await apiSetPin(newHash)
        updateUser({ hasPin: true })
        setResetFlow('off')
        setResetPin('')
        setFirstNewPin('')
        setPinError('')
        setPin('')
      } catch (err) {
        onError(err instanceof Error ? err.message : 'PIN reset failed')
      } finally {
        setResetLoading(false)
      }
    }
  }, [resetFlow, firstNewPin, user, onError])

  useEffect(() => {
    if (resetFlow !== 'off' && resetPin.length === 6 && !resetLoading) {
      void submitResetPin(resetPin)
    }
  }, [resetPin, resetFlow, resetLoading, submitResetPin])
  // ────────────────────────────────────────────────────────

  const submit = useCallback(async (currentPin: string) => {
    if (submittedRef.current) return
    if (!user || !deviceId) { onError('Session expired — please log in again.'); return }

    submittedRef.current = true
    setLoading(true)
    setPinError('')

    try {
      const pinHash = await hashPin(currentPin, user.id)
      const sig = await signTransaction({
        action:    'bank_transfer',
        userId:    user.id,
        deviceId,
        amount:    amountNgn,
        recipient: `${recipient.bankCode}:${recipient.accountNumber}`,
      })
      const result = await bankTransfer({
        bankCode:        recipient.bankCode,
        accountNumber:   recipient.accountNumber,
        accountName:     recipient.accountName,
        amountNgn,
        pinHash,
        deviceSignature: sig.deviceSignature,
        deviceId:        sig.deviceId,
        timestamp:       String(sig.timestamp),
        nonce:           sig.nonce,
      })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BALANCE })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS(1) })
      onSuccess(result)
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      if (msg.toLowerCase().includes('incorrect pin')) {
        setPinError('Incorrect PIN — try again')
        setPin('')
      } else {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [user, deviceId, queryClient, recipient, amountNgn, onSuccess, onError])

  useEffect(() => {
    if (resetFlow === 'off' && pin.length === 6 && !loading) {
      void submit(pin)
    }
  }, [pin, loading, submit, resetFlow])

  const formattedAmount = parseInt(amountNgn, 10).toLocaleString('en-NG')

  return (
    <div className="flex flex-col flex-1">
      {/* Summary card */}
      <div className="rounded-3xl border border-white/8 bg-white/4 p-5 mb-6">
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">To</span>
          <span className="text-sm text-white/80 font-medium">{recipient.accountName}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Bank</span>
          <span className="text-sm text-white/80 font-medium">{recipient.bankName}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Account</span>
          <span className="text-sm text-white/80 font-mono">{recipient.accountNumber}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Amount</span>
          <span className="text-base font-semibold text-white">₦{formattedAmount}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Cheese fee</span>
          <span className="text-xs text-white/50">${feeUsdcAmount.toFixed(2)} USDC</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Total</span>
          <span className="text-sm font-semibold text-white">{totalUsdc > 0 ? `$${totalUsdc.toFixed(4)} USDC` : '…'}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {!user?.hasPin ? (
          <SetPinFlow onCancel={onBack} />
        ) : (loading || resetLoading) ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-white/40">
              {resetLoading ? 'Setting new PIN…' : 'Processing transfer…'}
            </p>
          </div>
        ) : resetFlow !== 'off' ? (
          <PinPad
            value={resetPin}
            onChange={setResetPin}
            maxLength={6}
            label={resetFlow === 'new' ? 'Enter your new PIN' : 'Confirm your new PIN'}
            error={pinError}
          />
        ) : (
          <PinPad
            value={pin}
            onChange={setPin}
            maxLength={6}
            label="Enter your PIN to confirm"
            error={pinError}
          />
        )}
      </div>

      {user?.hasPin && !loading && !resetLoading && (
        <div className="flex flex-col items-center gap-3 mt-4">
          {resetFlow === 'off' ? (
            <>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
              >
                <ArrowLeft size={14} />
                Change amount
              </button>
              <button
                type="button"
                onClick={() => { setPinError(''); setPin(''); setResetFlow('new') }}
                className="text-xs text-white/25 hover:text-[#d4a843]/60 transition-colors"
              >
                Forgot PIN?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setResetFlow('off'); setResetPin(''); setFirstNewPin(''); setPinError('') }}
              className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
            >
              <ArrowLeft size={14} />
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Success screen — USDC
// ─────────────────────────────────────────────────────────
function SuccessScreen({
  tx,
  recipient,
  amount,
  onDone,
  onSendAnother,
}: {
  tx: Transaction
  recipient: ResolvedRecipient
  amount: string
  onDone: () => void
  onSendAnother: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState<ShareFormat | false>(false)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    playChaChing()
    const burst = (angle: number, origin: { x: number; y: number }) =>
      confetti({ particleCount: 60, angle, spread: 55, origin, colors: ['#d4a843', '#FFD700', '#FFA500', '#fff', '#34d399'], scalar: 0.8 })
    burst(60, { x: 0, y: 0.65 })
    burst(120, { x: 1, y: 0.65 })
    setTimeout(() => { burst(80, { x: 0.2, y: 0.7 }); burst(100, { x: 0.8, y: 0.7 }) }, 250)
  }, [])

  const statusLabel = tx.status === 'pending' ? 'Pending' : 'Completed'
  const statusColor = tx.status === 'pending' ? '#fbbf24' : '#34d399'
  const statusBg    = tx.status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.12)'

  const date = new Date(tx.createdAt).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rows = [
    { label: 'To',     value: recipient.display },
    { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)} USDC` },
    { label: 'Status', value: tx.status === 'pending' ? 'Pending' : 'Confirmed' },
    ...(tx.txHash ? [{ label: 'Tx hash', value: `${tx.txHash.slice(0, 10)}…` }] : []),
  ] as { label: string; value: string }[]

  const detailRows = [
    { label: 'TYPE',   value: 'Sent' },
    { label: 'DATE',   value: date },
    { label: 'TO',     value: recipient.display },
    { label: 'AMOUNT', value: `$${parseFloat(amount).toFixed(2)} USDC` },
  ]

  const refRows = [
    { label: 'REFERENCE', value: tx.reference },
    ...(tx.txHash ? [{ label: 'TX HASH', value: tx.txHash.length > 22 ? `${tx.txHash.slice(0, 22)}…` : tx.txHash }] : []),
  ]

  async function shareReceipt(format: ShareFormat) {
    if (!receiptRef.current || sharing) return
    setSharing(format)
    try {
      await captureAndShare(receiptRef.current, format)
    } catch (err) {
      console.error('[share receipt]', err)
    } finally {
      setSharing(false)
      setShowPicker(false)
    }
  }

  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      {/* Off-screen receipt card — matches Transaction Detail design */}
      <div
        ref={receiptRef}
        aria-hidden
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '375px', background: '#141414',
          borderRadius: '24px', padding: '32px 20px 28px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <p style={{ color: '#d4a843', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '24px', textTransform: 'uppercase' }}>cheese pay</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUpRight size={28} style={{ color: 'rgba(255,255,255,0.7)' }} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <span style={{ color: 'white', fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em' }}>
            -${parseFloat(amount).toFixed(2)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', fontWeight: '500', marginLeft: '6px' }}>USDC</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ background: statusBg, color: statusColor, fontSize: '12px', fontWeight: '500', padding: '4px 14px', borderRadius: '20px' }}>{statusLabel}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '12px' }}>
          {detailRows.map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < detailRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '500', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '24px' }}>
          {refRows.map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < refRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
            </div>
          ))}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', letterSpacing: '0.04em' }}>cheesepay.xyz</p>
      </div>

      <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle2 size={38} className="text-emerald-400" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-1">Sent!</h2>
      <p className="text-sm text-white/40 mb-8">Transfer submitted successfully</p>

      <div className="w-full rounded-3xl border border-white/8 bg-white/4 p-5 mb-8">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/6 last:border-0">
            <span className="text-xs text-white/35 uppercase tracking-wide">{label}</span>
            <span className="text-sm text-white/80 font-medium">{value}</span>
          </div>
        ))}
      </div>

      <Button fullWidth size="lg" onClick={onDone} className="mb-3">
        Back to home
      </Button>

      {/* Share receipt — format picker */}
      {!showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          disabled={!!sharing}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-3 disabled:opacity-40"
        >
          <Share2 size={14} />
          Share receipt
        </button>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => shareReceipt('jpeg')}
            disabled={!!sharing}
            className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/25 text-[#d4a843] text-sm font-medium hover:bg-[#d4a843]/25 transition-colors disabled:opacity-40"
          >
            {sharing === 'jpeg' ? <Spinner size="sm" /> : null}
            JPEG
          </button>
          <button
            type="button"
            onClick={() => shareReceipt('pdf')}
            disabled={!!sharing}
            className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/25 text-[#d4a843] text-sm font-medium hover:bg-[#d4a843]/25 transition-colors disabled:opacity-40"
          >
            {sharing === 'pdf' ? <Spinner size="sm" /> : null}
            PDF
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            disabled={!!sharing}
            className="px-3 py-2 rounded-xl bg-white/6 text-white/40 text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onSendAnother}
        className="text-sm text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
      >
        Send to someone else
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Success screen — Bank transfer
// ─────────────────────────────────────────────────────────
function BankSuccessScreen({
  transfer,
  recipient,
  amountNgn,
  onDone,
  onSendAnother,
}: {
  transfer: BankTransferResponse | null
  recipient: BankRecipient
  amountNgn: string
  onDone: () => void
  onSendAnother: () => void
}) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState<ShareFormat | false>(false)
  const [showPicker, setShowPicker] = useState(false)

  const isCompleted = transfer?.status === 'completed'

  useEffect(() => {
    if (isCompleted) {
      playChaChing()
      const burst = (angle: number, origin: { x: number; y: number }) =>
        confetti({ particleCount: 60, angle, spread: 55, origin, colors: ['#d4a843', '#FFD700', '#FFA500', '#fff', '#34d399'], scalar: 0.8 })
      burst(60, { x: 0, y: 0.65 })
      burst(120, { x: 1, y: 0.65 })
      setTimeout(() => { burst(80, { x: 0.2, y: 0.7 }); burst(100, { x: 0.8, y: 0.7 }) }, 250)
    }
  }, [isCompleted])

  const formattedAmount = parseInt(amountNgn, 10).toLocaleString('en-NG')
  const statusLabel = isCompleted ? 'Completed' : 'Processing'
  const heading = isCompleted ? 'Sent!' : 'Transfer submitted'
  const subtitle = isCompleted
    ? 'Bank transfer sent successfully'
    : (transfer?.message ?? 'You\u2019ll be notified once the payout settles.')

  const statusColor = isCompleted ? '#34d399' : '#fbbf24'
  const statusBg    = isCompleted ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.15)'
  const statusBadge = isCompleted ? 'Completed' : 'Processing'

  const date = new Date().toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const rows = [
    { label: 'To',      value: recipient.accountName },
    { label: 'Bank',    value: recipient.bankName },
    { label: 'Account', value: recipient.accountNumber },
    { label: 'Amount',  value: `₦${formattedAmount}` },
    { label: 'Status',  value: statusLabel },
    ...(transfer?.reference ? [{ label: 'Reference', value: transfer.reference }] : []),
  ]

  const detailRows = [
    { label: 'TYPE',      value: 'Bank Transfer' },
    { label: 'DATE',      value: date },
    { label: 'RECIPIENT', value: recipient.accountName },
    { label: 'BANK',      value: recipient.bankName },
    { label: 'ACCOUNT',   value: recipient.accountNumber },
    { label: 'AMOUNT',    value: `₦${formattedAmount}` },
    ...(transfer?.amountUsdc ? [{ label: 'USDC', value: `$${parseFloat(transfer.amountUsdc).toFixed(2)}` }] : []),
  ]

  const refRows = [
    ...(transfer?.reference ? [{ label: 'REFERENCE', value: transfer.reference }] : []),
    ...(transfer?.stellarTxHash ? [{ label: 'TX HASH', value: transfer.stellarTxHash.length > 22 ? `${transfer.stellarTxHash.slice(0, 22)}…` : transfer.stellarTxHash }] : []),
  ]

  async function shareReceipt(format: ShareFormat) {
    if (!receiptRef.current || sharing) return
    setSharing(format)
    try {
      await captureAndShare(receiptRef.current, format)
    } catch (err) {
      console.error('[share receipt]', err)
    } finally {
      setSharing(false)
      setShowPicker(false)
    }
  }

  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      {/* Off-screen receipt card — matches Transaction Detail design */}
      <div
        ref={receiptRef}
        aria-hidden
        style={{
          position: 'fixed', left: '-9999px', top: 0,
          width: '375px', background: '#141414',
          borderRadius: '24px', padding: '32px 20px 28px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <p style={{ color: '#d4a843', fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '24px', textTransform: 'uppercase' }}>cheese pay</p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={28} style={{ color: '#38bdf8' }} />
          </div>
        </div>
        {transfer?.amountUsdc && (
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em' }}>
              -${parseFloat(transfer.amountUsdc).toFixed(2)}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px', fontWeight: '500', marginLeft: '6px' }}>USDC</span>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>≈ ₦{formattedAmount}</p>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ background: statusBg, color: statusColor, fontSize: '12px', fontWeight: '500', padding: '4px 14px', borderRadius: '20px' }}>{statusBadge}</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '12px' }}>
          {detailRows.map(({ label, value }, i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < detailRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: '500', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
        </div>
        {refRows.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '0 16px', marginBottom: '24px' }}>
            {refRows.map(({ label, value }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: '12px 0', borderBottom: i < refRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'monospace', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', textAlign: 'center', letterSpacing: '0.04em' }}>cheesepay.xyz</p>
      </div>

      <div className={cn(
        'w-20 h-20 rounded-full flex items-center justify-center mb-6 border',
        isCompleted
          ? 'bg-emerald-500/15 border-emerald-500/20'
          : 'bg-amber-500/15 border-amber-500/20',
      )}>
        {isCompleted
          ? <CheckCircle2 size={38} className="text-emerald-400" />
          : <Clock size={38} className="text-amber-400" />}
      </div>

      <h2 className="text-2xl font-semibold text-white mb-1">{heading}</h2>
      <p className="text-sm text-white/40 mb-8 text-center">{subtitle}</p>

      <div className="w-full rounded-3xl border border-white/8 bg-white/4 p-5 mb-8">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/6 last:border-0">
            <span className="text-xs text-white/35 uppercase tracking-wide">{label}</span>
            <span className="text-sm text-white/80 font-medium">{value}</span>
          </div>
        ))}
      </div>

      <Button fullWidth size="lg" onClick={onDone} className="mb-3">
        Back to home
      </Button>

      {/* Share receipt — format picker */}
      {!showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          disabled={!!sharing}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-3 disabled:opacity-40"
        >
          <Share2 size={14} />
          Share receipt
        </button>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => shareReceipt('jpeg')}
            disabled={!!sharing}
            className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/25 text-[#d4a843] text-sm font-medium hover:bg-[#d4a843]/25 transition-colors disabled:opacity-40"
          >
            {sharing === 'jpeg' ? <Spinner size="sm" /> : null}
            JPEG
          </button>
          <button
            type="button"
            onClick={() => shareReceipt('pdf')}
            disabled={!!sharing}
            className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-[#d4a843]/15 border border-[#d4a843]/25 text-[#d4a843] text-sm font-medium hover:bg-[#d4a843]/25 transition-colors disabled:opacity-40"
          >
            {sharing === 'pdf' ? <Spinner size="sm" /> : null}
            PDF
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(false)}
            disabled={!!sharing}
            className="px-3 py-2 rounded-xl bg-white/6 text-white/40 text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onSendAnother}
        className="text-sm text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
      >
        Send to someone else
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bridge details step — amount + recipient for non-Nigeria
// ─────────────────────────────────────────────────────────
interface BridgeRecipient {
  countryCode: string
  countryName: string
  currency: string
  recipientName: string
  accountIdentifier: string
  bankCode?: string
  bankName?: string
  feePercent: number
  minTransferUsdc: number
  maxTransferUsdc: number
}

function BridgeDetailsStep({
  countryCode,
  onNext,
}: {
  countryCode: string
  onNext: (recipient: BridgeRecipient, amountUsdc: string) => void
}) {
  const country = BANK_COUNTRIES.find((c) => c.code === countryCode)
  const [recipientName, setRecipientName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [amountError, setAmountError] = useState('')

  const bridgeCountriesQ = useQuery({
    queryKey: QUERY_KEYS.BRIDGE_COUNTRIES,
    queryFn: getBridgeCountries,
    staleTime: STALE_TIMES.BANKS,
  })
  const bridgeConfig = bridgeCountriesQ.data?.find((c) => c.code === countryCode)

  const balanceQ = useQuery({
    queryKey: QUERY_KEYS.BALANCE,
    queryFn: getBalance,
    staleTime: STALE_TIMES.BALANCE,
  })
  const usdcBalance = parseFloat(balanceQ.data?.totalUsdc ?? '0')

  const minUsdc = bridgeConfig?.minTransferUsdc ?? 1
  const maxUsdc = bridgeConfig?.maxTransferUsdc ?? 500
  const feePercent = bridgeConfig?.feePercent ?? 1.5

  const amount = parseFloat(amountRaw) || 0
  const feeUsdc = amount > 0 ? (amount * feePercent) / 100 : 0
  const totalUsdc = amount + feeUsdc
  const overBalance = usdcBalance > 0 && totalUsdc > usdcBalance

  function handleAmountInput(v: string) {
    const clean = v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setAmountRaw(clean)
    const parsed = parseFloat(clean) || 0
    const parsedFee = parsed > 0 ? (parsed * feePercent) / 100 : 0
    const parsedTotal = parsed + parsedFee
    if (usdcBalance > 0 && parsedTotal > usdcBalance) {
      setAmountError(`Insufficient balance — available: $${usdcBalance.toFixed(2)} USDC`)
    } else {
      setAmountError('')
    }
  }

  const canConfirm =
    recipientName.trim().length >= 2 &&
    accountId.trim().length >= 4 &&
    amount >= minUsdc &&
    amount <= maxUsdc &&
    !overBalance

  function handleConfirm() {
    if (!bridgeConfig) return
    if (amount < minUsdc) { setAmountError(`Minimum is $${minUsdc} USDC`); return }
    if (amount > maxUsdc) { setAmountError(`Maximum is $${maxUsdc} USDC`); return }
    if (overBalance) { setAmountError(`Insufficient balance`); return }
    onNext(
      {
        countryCode,
        countryName: country?.name ?? countryCode,
        currency: bridgeConfig.currency,
        recipientName: recipientName.trim(),
        accountIdentifier: accountId.trim(),
        feePercent,
        minTransferUsdc: minUsdc,
        maxTransferUsdc: maxUsdc,
      },
      amountRaw,
    )
  }

  if (bridgeCountriesQ.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-white/40">Loading country config…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Country badge */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/4 border border-white/8">
        <span className="text-xl leading-none">{country?.flag ?? '🌍'}</span>
        <div>
          <p className="text-sm font-semibold text-white">{country?.name ?? countryCode}</p>
          <p className="text-xs text-white/40">{bridgeConfig?.currency ?? ''} via {bridgeConfig?.paymentRail === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}</p>
        </div>
      </div>

      {/* Recipient name */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Recipient Name</p>
        <div className={cn(
          'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
          recipientName.length >= 2 ? 'border-white/15' : 'border-white/10 focus-within:border-[#d4a843]/50',
        )}>
          <User size={15} className="text-white/30 shrink-0" />
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Full name"
            autoFocus
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
          />
          {recipientName.length >= 2 && <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />}
        </div>
      </div>

      {/* Account identifier (phone or bank account) */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">
          {bridgeConfig?.paymentRail === 'mpesa' ? 'Phone Number' : 'Account Number'}
        </p>
        <div className={cn(
          'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
          accountId.length >= 4 ? 'border-white/15' : 'border-white/10 focus-within:border-[#d4a843]/50',
        )}>
          <Building2 size={15} className="text-white/30 shrink-0" />
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder={bridgeConfig?.paymentRail === 'mpesa' ? '+254…' : 'Account number'}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none font-mono"
          />
          {accountId.length >= 4 && <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />}
        </div>
      </div>

      {/* Amount in USDC */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Amount (USDC)</p>
          {balanceQ.data && (
            <p className={cn('text-xs', overBalance ? 'text-red-400' : 'text-white/30')}>
              Available: ${usdcBalance.toFixed(2)}
            </p>
          )}
        </div>
        <div className={cn(
          'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
          overBalance || amountError ? 'border-red-500/40' :
          amount >= minUsdc          ? 'border-[#d4a843]/40' :
          'border-white/10 focus-within:border-[#d4a843]/50',
        )}>
          <span className="text-white/30 text-sm font-medium shrink-0">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amountRaw}
            onChange={(e) => handleAmountInput(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
          />
          <span className="text-white/20 text-xs shrink-0">USDC</span>
        </div>

        {amountError && (
          <p className="text-xs text-red-400 mt-2 px-1">{amountError}</p>
        )}
        {amountRaw && amount > 0 && amount < minUsdc && !amountError && (
          <p className="text-xs text-amber-400 mt-2 px-1">Minimum transfer is ${minUsdc} USDC</p>
        )}

        {/* Fee summary */}
        {amount >= minUsdc && !amountError && totalUsdc > 0 && (
          <div className="rounded-2xl bg-white/4 border border-white/6 px-4 py-3 mt-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/40">You send</span>
              <span className="text-white/70">${amount.toFixed(2)} USDC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Fee ({feePercent}%)</span>
              <span className="text-white/50">${feeUsdc.toFixed(4)} USDC</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/6 pt-1.5">
              <span className="text-white/40">Total deducted</span>
              <span className="text-white font-medium">${totalUsdc.toFixed(4)} USDC</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto">
        <Button
          fullWidth
          size="lg"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          Confirm
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// PIN step — Bridge transfer
// ─────────────────────────────────────────────────────────
function BridgePinStep({
  recipient,
  amountUsdc,
  onBack,
  onSuccess,
  onError,
}: {
  recipient: BridgeRecipient
  amountUsdc: string
  onBack: () => void
  onSuccess: (result: BridgeTransferResponse) => void
  onError: (msg: string) => void
}) {
  const { user, deviceId, updateUser } = useAuthStore()
  const queryClient               = useQueryClient()
  const [pin, setPin]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [pinError, setPinError]   = useState('')
  const submittedRef              = useRef(false)

  const amount     = parseFloat(amountUsdc)
  const feeUsdc    = (amount * recipient.feePercent) / 100
  const totalUsdc  = amount + feeUsdc

  // ── Forgot PIN reset flow ───────────────────────────────
  type ResetFlow = 'off' | 'new' | 'confirm'
  const [resetFlow, setResetFlow]   = useState<ResetFlow>('off')
  const [firstNewPin, setFirstNewPin] = useState('')
  const [resetPin, setResetPin]     = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const submitResetPin = useCallback(async (input: string) => {
    if (resetFlow === 'new') {
      setFirstNewPin(input)
      setResetPin('')
      setResetFlow('confirm')
      return
    }
    if (resetFlow === 'confirm') {
      if (input !== firstNewPin) {
        setPinError("PINs don't match — try again")
        setResetPin('')
        setResetFlow('new')
        setFirstNewPin('')
        return
      }
      if (!user) { onError('Session expired'); return }
      setResetLoading(true)
      try {
        await apiResetPin()
        const newHash = await hashPin(firstNewPin, user.id)
        await apiSetPin(newHash)
        updateUser({ hasPin: true })
        setResetFlow('off')
        setResetPin('')
        setFirstNewPin('')
        setPinError('')
        setPin('')
      } catch (err) {
        onError(err instanceof Error ? err.message : 'PIN reset failed')
      } finally {
        setResetLoading(false)
      }
    }
  }, [resetFlow, firstNewPin, user, onError])

  useEffect(() => {
    if (resetFlow !== 'off' && resetPin.length === 6 && !resetLoading) {
      void submitResetPin(resetPin)
    }
  }, [resetPin, resetFlow, resetLoading, submitResetPin])
  // ────────────────────────────────────────────────────────

  const submit = useCallback(async (currentPin: string) => {
    if (submittedRef.current) return
    if (!user || !deviceId) { onError('Session expired — please log in again.'); return }

    submittedRef.current = true
    setLoading(true)
    setPinError('')

    try {
      const pinHash = await hashPin(currentPin, user.id)
      const sig = await signTransaction({
        action:    'bridge_transfer',
        userId:    user.id,
        deviceId,
        amount:    amountUsdc,
        recipient: `${recipient.countryCode}:${recipient.accountIdentifier}`,
      })
      const result = await bridgeTransfer({
        countryCode:       recipient.countryCode,
        amountUsdc,
        recipientName:     recipient.recipientName,
        accountIdentifier: recipient.accountIdentifier,
        bankCode:          recipient.bankCode,
        bankName:          recipient.bankName,
        pinHash,
        deviceSignature:   sig.deviceSignature,
        deviceId:          sig.deviceId,
        timestamp:         String(sig.timestamp),
        nonce:             sig.nonce,
      })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BALANCE })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS(1) })
      onSuccess(result)
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      if (msg.toLowerCase().includes('incorrect pin')) {
        setPinError('Incorrect PIN — try again')
        setPin('')
      } else {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [user, deviceId, queryClient, recipient, amountUsdc, onSuccess, onError])

  useEffect(() => {
    if (resetFlow === 'off' && pin.length === 6 && !loading) {
      void submit(pin)
    }
  }, [pin, loading, submit, resetFlow])

  return (
    <div className="flex flex-col flex-1">
      {/* Summary card */}
      <div className="rounded-3xl border border-white/8 bg-white/4 p-5 mb-6">
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">To</span>
          <span className="text-sm text-white/80 font-medium">{recipient.recipientName}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Country</span>
          <span className="text-sm text-white/80 font-medium">{recipient.countryName}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Account</span>
          <span className="text-sm text-white/80 font-mono">{recipient.accountIdentifier}</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Amount</span>
          <span className="text-base font-semibold text-white">${amount.toFixed(2)} USDC</span>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Fee ({recipient.feePercent}%)</span>
          <span className="text-xs text-white/50">${feeUsdc.toFixed(4)} USDC</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Total</span>
          <span className="text-sm font-semibold text-white">${totalUsdc.toFixed(4)} USDC</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {!user?.hasPin ? (
          <SetPinFlow onCancel={onBack} />
        ) : (loading || resetLoading) ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-white/40">
              {resetLoading ? 'Setting new PIN…' : 'Processing transfer…'}
            </p>
          </div>
        ) : resetFlow !== 'off' ? (
          <PinPad
            value={resetPin}
            onChange={setResetPin}
            maxLength={6}
            label={resetFlow === 'new' ? 'Enter your new PIN' : 'Confirm your new PIN'}
            error={pinError}
          />
        ) : (
          <PinPad
            value={pin}
            onChange={setPin}
            maxLength={6}
            label="Enter your PIN to confirm"
            error={pinError}
          />
        )}
      </div>

      {user?.hasPin && !loading && !resetLoading && (
        <div className="flex flex-col items-center gap-3 mt-4">
          {resetFlow === 'off' ? (
            <>
              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
              >
                <ArrowLeft size={14} />
                Change details
              </button>
              <button
                type="button"
                onClick={() => { setPinError(''); setPin(''); setResetFlow('new') }}
                className="text-xs text-white/25 hover:text-[#d4a843]/60 transition-colors"
              >
                Forgot PIN?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setResetFlow('off'); setResetPin(''); setFirstNewPin(''); setPinError('') }}
              className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors"
            >
              <ArrowLeft size={14} />
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Success screen — Bridge transfer
// ─────────────────────────────────────────────────────────
function BridgeSuccessScreen({
  transfer,
  recipient,
  amountUsdc,
  onDone,
  onSendAnother,
}: {
  transfer: BridgeTransferResponse | null
  recipient: BridgeRecipient
  amountUsdc: string
  onDone: () => void
  onSendAnother: () => void
}) {
  const isProcessing = transfer?.status === 'processing'

  useEffect(() => {
    playChaChing()
    const burst = (angle: number, origin: { x: number; y: number }) =>
      confetti({ particleCount: 60, angle, spread: 55, origin, colors: ['#d4a843', '#FFD700', '#FFA500', '#fff', '#34d399'], scalar: 0.8 })
    burst(60, { x: 0, y: 0.65 })
    burst(120, { x: 1, y: 0.65 })
    setTimeout(() => { burst(80, { x: 0.2, y: 0.7 }); burst(100, { x: 0.8, y: 0.7 }) }, 250)
  }, [])

  const amount = parseFloat(amountUsdc)
  const heading = 'Transfer submitted'
  const subtitle = transfer?.message ?? `You'll be notified once the payout to ${recipient.countryName} settles.`

  const rows = [
    { label: 'To',        value: recipient.recipientName },
    { label: 'Country',   value: recipient.countryName },
    { label: 'Account',   value: recipient.accountIdentifier },
    { label: 'Amount',    value: `$${amount.toFixed(2)} USDC` },
    { label: 'Currency',  value: transfer?.currency ?? recipient.currency },
    { label: 'Status',    value: isProcessing ? 'Processing' : (transfer?.status ?? 'Pending') },
    ...(transfer?.reference ? [{ label: 'Reference', value: transfer.reference }] : []),
  ]

  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      <div className="w-20 h-20 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center mb-6">
        <Clock size={38} className="text-amber-400" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-1">{heading}</h2>
      <p className="text-sm text-white/40 mb-8 text-center">{subtitle}</p>

      <div className="w-full rounded-3xl border border-white/8 bg-white/4 p-5 mb-8">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-2.5 border-b border-white/6 last:border-0">
            <span className="text-xs text-white/35 uppercase tracking-wide">{label}</span>
            <span className="text-sm text-white/80 font-medium">{value}</span>
          </div>
        ))}
      </div>

      <Button fullWidth size="lg" onClick={onDone} className="mb-3">
        Back to home
      </Button>

      <button
        type="button"
        onClick={onSendAnother}
        className="text-sm text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
      >
        Send to someone else
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Error screen
// ─────────────────────────────────────────────────────────
function ErrorScreen({
  message,
  onRetry,
  onBack,
}: {
  message: string
  onRetry: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
        <AlertCircle size={38} className="text-red-400" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-2">Transfer failed</h2>
      <p className="text-sm text-white/40 text-center px-4 mb-8">{message}</p>

      <Button fullWidth size="lg" onClick={onRetry} className="mb-3">
        Try again
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-white/30 hover:text-white/50 transition-colors"
      >
        Go to home
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
export default function SendPage() {
  const router = useRouter()

  const [mode,          setMode]          = useState<SendMode | null>(null)
  const [step,          setStep]          = useState<SendStep>('mode')
  const [usdcType,      setUsdcType]      = useState<UsdcType | null>(null)
  const [evmChain,      setEvmChain]      = useState('')
  const [username,      setUsername]      = useState('')
  const [address,       setAddress]       = useState('')
  const [recipient,     setRecipient]     = useState<ResolvedRecipient | null>(null)
  const [amount,        setAmount]        = useState('')
  const [sentTx,        setSentTx]        = useState<Transaction | null>(null)
  const [errMsg,        setErrMsg]        = useState('')
  const [bankRecipient, setBankRecipient] = useState<BankRecipient | null>(null)
  const [bankAmount,    setBankAmount]    = useState('')
  const [bankTransferResult, setBankTransferResult] = useState<BankTransferResponse | null>(null)
  // Bridge (non-Nigeria) state
  const [bridgeCountry,       setBridgeCountry]       = useState('')
  const [bridgeRecipient,     setBridgeRecipient]     = useState<BridgeRecipient | null>(null)
  const [bridgeAmount,        setBridgeAmount]        = useState('')
  const [bridgeTransferResult, setBridgeTransferResult] = useState<BridgeTransferResponse | null>(null)
  const isBridgeFlow = !!bridgeCountry

  // Recent recipients
  const { data: recents = [] } = useQuery({
    queryKey: QUERY_KEYS.RECENT_RECIPIENTS,
    queryFn: getRecentRecipients,
    staleTime: 60_000,
  })

  function handleSelectRecent(r: RecentRecipient) {
    const isEvm = r.network && r.network !== 'stellar'
    if (r.recipientUsername) {
      setMode('username')
      setUsdcType(isEvm ? 'evm' : 'stellar')
      setEvmChain(isEvm ? r.network! : '')
      setUsername(r.recipientUsername)
      setAddress('')
      setRecipient(null)
      setStep('recipient')
    } else if (r.recipientAddress) {
      setMode('usdc')
      setUsdcType(isEvm ? 'evm' : 'stellar')
      setEvmChain(isEvm ? r.network! : '')
      setUsername('')
      setAddress(r.recipientAddress)
      setRecipient(null)
      setStep('recipient')
    }
  }

  function handleModeSelect(m: SendMode) {
    setMode(m)
    setUsdcType(null)
    setEvmChain('')
    setUsername('')
    setAddress('')
    setRecipient(null)
    setBankRecipient(null)
    setBankAmount('')
    setBankTransferResult(null)
    setBridgeCountry('')
    setBridgeRecipient(null)
    setBridgeAmount('')
    setBridgeTransferResult(null)
    setStep(m === 'bank' ? 'bank_details' : m === 'usdc' ? 'usdc_network' : m === 'username' ? 'username_network' : 'recipient')
  }

  function handleBridgeCountrySelect(countryCode: string) {
    setMode(null)
    setBridgeCountry(countryCode)
    setBridgeRecipient(null)
    setBridgeAmount('')
    setBridgeTransferResult(null)
    setStep('bridge_details')
  }

  function resetRecipient() {
    setUsername('')
    setAddress('')
    setRecipient(null)
  }

  function reset() {
    setMode(null)
    setStep('mode')
    setUsdcType(null)
    setEvmChain('')
    setUsername('')
    setAddress('')
    setRecipient(null)
    setAmount('')
    setSentTx(null)
    setErrMsg('')
    setBankRecipient(null)
    setBankAmount('')
    setBankTransferResult(null)
    setBridgeCountry('')
    setBridgeRecipient(null)
    setBridgeAmount('')
    setBridgeTransferResult(null)
  }

  const isBankFlow = mode === 'bank'
  const network    = usdcType === 'evm' ? evmChain : 'stellar'

  const chainLabel = EVM_CHAINS.find((c) => c.id === evmChain)?.label ?? ''

  const showHeader = step !== 'success' && step !== 'error'

  const bridgeCountryName = BANK_COUNTRIES.find((c) => c.code === bridgeCountry)?.name ?? bridgeCountry

  const headerTitle =
    step === 'mode'             ? 'Send' :
    step === 'usdc_network'     ? 'Send USDC' :
    step === 'username_network' ? 'Send by Username' :
    step === 'recipient'        ? (mode === 'username' ? 'Send by Username' : usdcType === 'evm' ? `${chainLabel} USDC` : 'Stellar USDC') :
    step === 'amount'           ? 'Enter amount' :
    step === 'bank_details'     ? 'Send to Bank' :
    step === 'bridge_details'   ? `Send to ${bridgeCountryName}` :
    step === 'pin'              ? 'Confirm transfer' : ''

  const headerBack =
    step === 'mode'             ? () => router.back() :
    step === 'usdc_network'     ? () => setStep('mode') :
    step === 'username_network' ? () => setStep('mode') :
    step === 'recipient'        ? () => { if (mode === 'usdc') setStep('usdc_network'); else if (mode === 'username') setStep('username_network'); else setStep('mode') } :
    step === 'amount'           ? () => setStep('recipient') :
    step === 'bank_details'     ? () => setStep('mode') :
    step === 'bridge_details'   ? () => { setBridgeCountry(''); setStep('mode') } :
    step === 'pin'              ? () => { if (isBridgeFlow) setStep('bridge_details'); else if (isBankFlow) setStep('bank_details'); else setStep('amount') } :
    () => {}

  return (
    <div className="flex flex-col min-h-[calc(100vh-10rem)] px-6 py-6">

      {showHeader && (
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={headerBack}
            className="w-9 h-9 rounded-full bg-white/6 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-white">{headerTitle}</h1>
        </div>
      )}

      {/* Mode selection — entry point */}
      {step === 'mode' && (
        <>
          {recents.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Recent</p>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {recents.map((r, i) => {
                  const label = r.recipientUsername
                    ? `@${r.recipientUsername}`
                    : r.recipientAddress
                      ? `${r.recipientAddress.slice(0, 6)}…${r.recipientAddress.slice(-4)}`
                      : '?'
                  const initial = (r.recipientUsername ?? r.recipientAddress ?? '?')[0].toUpperCase()
                  return (
                    <button
                      key={r.recipientUsername ?? r.recipientAddress ?? i}
                      type="button"
                      onClick={() => handleSelectRecent(r)}
                      className="flex flex-col items-center gap-1.5 min-w-[4rem] group"
                    >
                      <div className="w-11 h-11 rounded-full bg-[#d4a843]/12 border border-[#d4a843]/25 flex items-center justify-center group-hover:bg-[#d4a843]/20 transition-colors">
                        <span className="text-sm font-bold text-[#d4a843]">{initial}</span>
                      </div>
                      <span className="text-[11px] text-white/50 truncate max-w-[4.5rem] text-center">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <ModeSelector onSelect={handleModeSelect} onSelectBridge={handleBridgeCountrySelect} />
        </>
      )}

      {/* USDC network selection — Stellar vs EVM */}
      {step === 'usdc_network' && (
        <UsdcNetworkStep
          onStellar={() => { setUsdcType('stellar'); setStep('recipient') }}
          onEvm={(chain) => { setUsdcType('evm'); setEvmChain(chain); setStep('recipient') }}
        />
      )}

      {/* Username network selection — Stellar vs EVM */}
      {step === 'username_network' && (
        <UsdcNetworkStep
          heading="Choose network for this username send"
          onStellar={() => { setUsdcType('stellar'); setStep('recipient') }}
          onEvm={(chain) => { setUsdcType('evm'); setEvmChain(chain); setStep('recipient') }}
        />
      )}

      {/* Recipient step (username, Stellar, or EVM) */}
      {step === 'recipient' && (
        <div className="flex flex-col gap-5 flex-1">
          {mode === 'username' ? (
            <UsernameInput
              value={username}
              onChange={setUsername}
              onResolved={setRecipient}
              onClear={resetRecipient}
            />
          ) : usdcType === 'evm' ? (
            <EvmAddressInput
              value={address}
              onChange={setAddress}
              onResolved={setRecipient}
              onClear={resetRecipient}
            />
          ) : (
            <AddressInput
              value={address}
              onChange={setAddress}
              onResolved={setRecipient}
              onClear={resetRecipient}
            />
          )}

          {recipient && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                {recipient.type === 'username'
                  ? <AtSign  size={16} className="text-emerald-400" />
                  : usdcType === 'evm'
                  ? <Layers  size={16} className="text-emerald-400" />
                  : <Wallet  size={16} className="text-emerald-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{recipient.display}</p>
                <p className="text-xs text-white/35 truncate font-mono mt-0.5">
                  {recipient.address}
                </p>
              </div>
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            </div>
          )}

          <div className="mt-auto">
            <Button
              fullWidth
              size="lg"
              onClick={() => { if (recipient) setStep('amount') }}
              disabled={!recipient}
            >
              Continue
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Amount step — USDC flows */}
      {step === 'amount' && recipient && (
        <AmountStep
          recipient={recipient}
          onBack={() => setStep('recipient')}
          onNext={(amt) => { setAmount(amt); setStep('pin') }}
        />
      )}

      {/* Bank details step — includes amount entry; goes directly to PIN on confirm */}
      {step === 'bank_details' && (
        <BankDetailsStep
          onNext={(r, amt) => { setBankRecipient(r); setBankAmount(amt); setStep('pin') }}
          recentBankRecipients={recents.filter((r) => r.type === 'bank_transfer' && r.bankName)}
        />
      )}

      {/* Bridge details step — non-Nigeria off-ramp */}
      {step === 'bridge_details' && bridgeCountry && (
        <BridgeDetailsStep
          countryCode={bridgeCountry}
          onNext={(r, amt) => { setBridgeRecipient(r); setBridgeAmount(amt); setStep('pin') }}
        />
      )}

      {/* PIN — USDC flows */}
      {step === 'pin' && !isBankFlow && !isBridgeFlow && recipient && (
        <PinStep
          recipient={recipient}
          amount={amount}
          network={network}
          onBack={() => setStep('amount')}
          onSuccess={(tx) => { setSentTx(tx); setStep('success') }}
          onError={(msg) => { setErrMsg(msg); setStep('error') }}
        />
      )}

      {/* PIN — Bank flow */}
      {step === 'pin' && isBankFlow && bankRecipient && (
        <BankPinStep
          recipient={bankRecipient}
          amountNgn={bankAmount}
          onBack={() => setStep('bank_details')}
          onSuccess={(result) => { setBankTransferResult(result); setStep('success') }}
          onError={(msg) => { setErrMsg(msg); setStep('error') }}
        />
      )}

      {/* PIN — Bridge flow */}
      {step === 'pin' && isBridgeFlow && bridgeRecipient && (
        <BridgePinStep
          recipient={bridgeRecipient}
          amountUsdc={bridgeAmount}
          onBack={() => setStep('bridge_details')}
          onSuccess={(result) => { setBridgeTransferResult(result); setStep('success') }}
          onError={(msg) => { setErrMsg(msg); setStep('error') }}
        />
      )}

      {/* Success — USDC flows */}
      {step === 'success' && !isBankFlow && !isBridgeFlow && sentTx && recipient && (
        <SuccessScreen
          tx={sentTx}
          recipient={recipient}
          amount={amount}
          onDone={() => router.push('/dashboard')}
          onSendAnother={reset}
        />
      )}

      {/* Success — Bank flow */}
      {step === 'success' && isBankFlow && bankRecipient && (
        <BankSuccessScreen
          transfer={bankTransferResult}
          recipient={bankRecipient}
          amountNgn={bankAmount}
          onDone={() => router.push('/dashboard')}
          onSendAnother={reset}
        />
      )}

      {/* Success — Bridge flow */}
      {step === 'success' && isBridgeFlow && bridgeRecipient && (
        <BridgeSuccessScreen
          transfer={bridgeTransferResult}
          recipient={bridgeRecipient}
          amountUsdc={bridgeAmount}
          onDone={() => router.push('/dashboard')}
          onSendAnother={reset}
        />
      )}

      {/* Error */}
      {step === 'error' && (
        <ErrorScreen
          message={errMsg}
          onRetry={() => setStep('pin')}
          onBack={() => router.push('/dashboard')}
        />
      )}
    </div>
  )
}
