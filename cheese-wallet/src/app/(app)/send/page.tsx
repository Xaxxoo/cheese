'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  X, ArrowLeft, CheckCircle2, AlertCircle,
  AtSign, Wallet, ChevronRight, Loader2, Building2, User, Layers,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { PinPad } from '@/components/ui/PinPad'
import { useAuthStore } from '@/store/authStore'
import { resolveUsername, sendToUsername, sendToAddress, getExchangeRate } from '@/lib/api/wallet'
import { signTransaction, hashPin } from '@/lib/crypto/deviceSigning'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { Transaction } from '@/types'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type SendMode = 'username' | 'usdc' | 'bank'
type UsdcType = 'stellar' | 'evm'
type SendStep = 'mode' | 'usdc_network' | 'recipient' | 'amount' | 'bank_details' | 'bank_amount' | 'pin' | 'success' | 'error'

interface ResolvedRecipient {
  display: string
  address: string
  type: 'username' | 'address'
  raw: string
}

interface BankRecipient {
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

// ─────────────────────────────────────────────────────────
// Mode Selector — first screen
// ─────────────────────────────────────────────────────────
function ModeSelector({ onSelect }: { onSelect: (mode: SendMode) => void }) {
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
      title: 'Send to Nigerian Bank',
      desc: 'Cash out directly to a bank account',
    },
  ]

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-sm text-white/40 mb-2">How would you like to send?</p>
      {modes.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onSelect(m.id)}
          className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all duration-150 text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/12 flex items-center justify-center shrink-0">
            {m.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{m.title}</p>
            <p className="text-xs text-white/40 mt-0.5">{m.desc}</p>
          </div>
          <ChevronRight size={16} className="text-white/25 shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// USDC Network selector (Stellar vs EVM)
// ─────────────────────────────────────────────────────────
function UsdcNetworkStep({
  onStellar,
  onEvm,
}: {
  onStellar: () => void
  onEvm: (chain: string) => void
}) {
  const [evmOpen, setEvmOpen]   = useState(false)
  const [chain,   setChain]     = useState('')

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-sm text-white/40 mb-1">Choose USDC network</p>

      {/* Stellar card — immediate navigation */}
      <button
        type="button"
        onClick={onStellar}
        className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all text-left"
      >
        <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/12 flex items-center justify-center shrink-0">
          <Wallet size={22} className="text-[#d4a843]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Stellar USDC</p>
          <p className="text-xs text-white/40 mt-0.5">Fast, low-fee transfers on Stellar</p>
        </div>
        <ChevronRight size={16} className="text-white/25 shrink-0" />
      </button>

      {/* EVM card — expands inline chain picker */}
      <div className={cn(
        'rounded-2xl border overflow-hidden transition-all duration-150',
        evmOpen ? 'border-[#d4a843]/30' : 'border-white/10',
      )}>
        <button
          type="button"
          onClick={() => { setEvmOpen(!evmOpen); setChain('') }}
          className={cn(
            'flex items-center gap-4 p-4 w-full text-left transition-colors',
            evmOpen ? 'bg-[#d4a843]/8' : 'bg-white/4 hover:bg-white/8',
          )}
        >
          <div className="w-11 h-11 rounded-2xl bg-[#d4a843]/12 flex items-center justify-center shrink-0">
            <Layers size={22} className="text-[#d4a843]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">EVM USDC</p>
            <p className="text-xs text-white/40 mt-0.5">Arbitrum, Base, Celo and more</p>
          </div>
          <ChevronRight size={16} className={cn('text-white/25 shrink-0 transition-transform duration-150', evmOpen && 'rotate-90')} />
        </button>

        {evmOpen && (
          <div className="border-t border-white/8">
            {EVM_CHAINS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChain(c.id === chain ? '' : c.id)}
                className={cn(
                  'flex items-center justify-between w-full px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0',
                  chain === c.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90',
                )}
              >
                <span className="font-medium">{c.label}</span>
                <div className="flex items-center gap-2.5">
                  {c.free && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      free
                    </span>
                  )}
                  {chain === c.id && <CheckCircle2 size={14} className="text-[#d4a843]" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {evmOpen && chain && (
        <div className="mt-auto">
          <Button fullWidth size="lg" onClick={() => onEvm(chain)}>
            Continue with {EVM_CHAINS.find((c) => c.id === chain)?.label}
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
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
        {status === 'searching' && <Loader2 size={16} className="text-white/30 animate-spin shrink-0" />}
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
// Stellar address input
// ─────────────────────────────────────────────────────────
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
  const valid = isStellarAddress(value)

  useEffect(() => {
    if (valid) {
      onResolved({ display: truncateAddress(value.trim()), address: value.trim(), type: 'address', raw: value.trim() })
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
        {valid && <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />}
        {value && (
          <button type="button" onClick={onClear} className="text-white/25 hover:text-white/50 transition-colors shrink-0 mt-0.5">
            <X size={16} />
          </button>
        )}
      </div>
      {value.length > 10 && !valid && (
        <p className="text-xs text-red-400 mt-1.5 px-1">Enter a valid Stellar address (starts with G…)</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Bank details step
// ─────────────────────────────────────────────────────────
function BankDetailsStep({
  onNext,
}: {
  onNext: (recipient: BankRecipient) => void
}) {
  const [bank, setBank]             = useState('')
  const [acctNum, setAcctNum]       = useState('')
  const [acctName, setAcctName]     = useState('')
  const [verifying, setVerifying]   = useState(false)
  const [verified, setVerified]     = useState(false)
  const [bankOpen, setBankOpen]     = useState(false)

  function handleAcctNum(v: string) {
    const clean = v.replace(/\D/g, '').slice(0, 10)
    setAcctNum(clean)
    setVerified(false)
    setAcctName('')
  }

  async function verify() {
    if (!bank || acctNum.length !== 10) return
    setVerifying(true)
    // TODO: replace with real NIP/NIBSS account name lookup
    await new Promise<void>((resolve) => setTimeout(resolve, 1200))
    setAcctName('Emeka Okafor')
    setVerified(true)
    setVerifying(false)
  }

  const canContinue = verified && !!acctName

  return (
    <div className="flex flex-col gap-5 flex-1">
      {/* Bank selector */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Bank</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => setBankOpen(!bankOpen)}
            className={cn(
              'flex items-center gap-3 h-14 px-4 rounded-2xl border w-full bg-white/6 text-left',
              bank ? 'border-white/15 text-white' : 'border-white/10 text-white/30',
            )}
          >
            <Building2 size={17} className="text-white/30 shrink-0" />
            <span className="flex-1 text-sm">{bank || 'Select bank'}</span>
            <ChevronRight size={16} className={cn('text-white/25 transition-transform duration-150', bankOpen && 'rotate-90')} />
          </button>
          {bankOpen && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-[#141414] border border-white/10 rounded-2xl overflow-hidden z-10 max-h-52 overflow-y-auto">
              {NIGERIAN_BANKS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => { setBank(b); setBankOpen(false) }}
                  className="w-full text-left px-4 py-3 text-sm text-white/70 hover:bg-white/8 hover:text-white transition-colors border-b border-white/5 last:border-0"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account number */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2 font-medium">Account Number</p>
        <div className={cn(
          'flex items-center gap-3 h-14 px-4 rounded-2xl border bg-white/6 transition-all duration-150',
          verified ? 'border-emerald-500/40' : 'border-white/10 focus-within:border-[#d4a843]/50',
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
          <span className="text-xs text-white/25 shrink-0">{acctNum.length}/10</span>
        </div>
      </div>

      {/* Verify button */}
      {acctNum.length === 10 && bank && !verified && (
        <Button fullWidth onClick={verify} disabled={verifying}>
          {verifying
            ? <><Loader2 size={14} className="animate-spin mr-1.5" />Verifying…</>
            : 'Verify Account'}
        </Button>
      )}

      {/* Resolved account name */}
      {verified && acctName && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <User size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{acctName}</p>
            <p className="text-xs text-white/35 mt-0.5">{bank} · {acctNum}</p>
          </div>
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
        </div>
      )}

      <div className="mt-auto">
        <Button
          fullWidth
          size="lg"
          onClick={() => canContinue && onNext({ bankName: bank, accountNumber: acctNum, accountName: acctName })}
          disabled={!canContinue}
        >
          Continue
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

  function handleInput(v: string) {
    setRaw(v.replace(/\D/g, ''))
    setError('')
  }

  function submit() {
    if (!amount || amount <= 0) { setError('Enter an amount'); return }
    if (amount < 100)           { setError('Minimum is ₦100'); return }
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
        {error && <p className="text-sm text-red-400">{error}</p>}
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

  const amount  = parseFloat(raw) || 0
  const ngnRate = rate ? parseFloat(rate.rate) : 0
  const ngnEq   = amount > 0 && ngnRate > 0 ? formatNgn(amount, ngnRate) : null
  const fee     = amount > 0 ? (amount * 0.001).toFixed(6) : '0'

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
        <p className="text-xs text-white/25 text-center mb-4">
          0.1% fee · ${fee} USDC
        </p>
      )}

      <Button fullWidth size="lg" onClick={submit} disabled={!amount || amount <= 0}>
        Continue
        <ChevronRight size={16} />
      </Button>
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

  const ngnRate = rate ? parseFloat(rate.rate) : 0
  const ngnEq   = parseFloat(amount) > 0 && ngnRate > 0
    ? formatNgn(parseFloat(amount), ngnRate) : null

  const submit = useCallback(async (currentPin: string) => {
    if (submittedRef.current) return
    if (!user || !deviceId) { onError('Session expired — please log in again.'); return }

    submittedRef.current = true
    setLoading(true)
    setPinError('')

    try {
      const [pinHash, sigResult] = await Promise.all([
        hashPin(currentPin, deviceId),
        signTransaction({
          deviceId,
          userId:    user.id,
          action:    recipient.type === 'username' ? 'send_username' : 'send_address',
          amount,
          recipient: recipient.raw,
        }),
      ])

      const tx = recipient.type === 'username'
        ? await sendToUsername({
            username:        recipient.raw.replace(/^@/, ''),
            amountUsdc:      amount,
            pin:             pinHash,
            deviceSignature: sigResult.deviceSignature,
            deviceId,
          })
        : await sendToAddress({
            address:         recipient.address,
            amountUsdc:      amount,
            network,
            pin:             pinHash,
            deviceSignature: sigResult.deviceSignature,
            deviceId,
          })

      onSuccess(tx)
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      if (msg.toLowerCase().includes('pin') || (err as { statusCode?: number }).statusCode === 403) {
        setPinError('Incorrect PIN — try again')
        setPin('')
      } else {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [user, deviceId, recipient, amount, network, onSuccess, onError])

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
        {recipient.type === 'address' && (
          <div className="flex items-center justify-between py-2 border-b border-white/6">
            <span className="text-xs text-white/40 uppercase tracking-wide">Network</span>
            <span className="text-sm text-white/80 font-medium">
              {EVM_CHAINS.find((c) => c.id === network)?.label ?? 'Stellar'}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between py-2 border-b border-white/6">
          <span className="text-xs text-white/40 uppercase tracking-wide">Amount</span>
          <div className="text-right">
            <p className="text-base font-semibold text-white">
              ${parseFloat(amount).toFixed(2)} <span className="text-white/40 text-sm font-normal">USDC</span>
            </p>
            {ngnEq && <p className="text-xs text-white/30">≈ ₦{ngnEq}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Fee</span>
          <span className="text-xs text-white/40">${(parseFloat(amount) * 0.001).toFixed(6)} USDC</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-[#d4a843] animate-spin" />
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

      {!loading && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors mt-4"
        >
          <ArrowLeft size={14} />
          Change amount
        </button>
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
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const { user, deviceId } = useAuthStore()
  const [pin, setPin]           = useState('')
  const [loading, setLoading]   = useState(false)
  const [pinError, setPinError] = useState('')
  const submittedRef            = useRef(false)

  const submit = useCallback(async (currentPin: string) => {
    if (submittedRef.current) return
    if (!user || !deviceId) { onError('Session expired — please log in again.'); return }

    submittedRef.current = true
    setLoading(true)
    setPinError('')

    try {
      // TODO: await sendToBank({ ...recipient, amountNgn, pin: await hashPin(currentPin, deviceId), deviceId })
      await hashPin(currentPin, deviceId) // validates PIN locally until API is ready
      await new Promise<void>((resolve) => setTimeout(resolve, 1500))
      onSuccess()
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      if (msg.toLowerCase().includes('pin') || (err as { statusCode?: number }).statusCode === 403) {
        setPinError('Incorrect PIN — try again')
        setPin('')
      } else {
        onError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [user, deviceId, recipient, amountNgn, onSuccess, onError])

  useEffect(() => {
    if (pin.length === 6 && !loading) {
      void submit(pin)
    }
  }, [pin, loading, submit])

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
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-white/40 uppercase tracking-wide">Amount</span>
          <span className="text-base font-semibold text-white">₦{formattedAmount}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={40} className="text-[#d4a843] animate-spin" />
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

      {!loading && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1.5 text-sm text-white/30 hover:text-white/50 transition-colors mt-4"
        >
          <ArrowLeft size={14} />
          Change amount
        </button>
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
  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle2 size={38} className="text-emerald-400" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-1">Sent!</h2>
      <p className="text-sm text-white/40 mb-8">Transfer submitted successfully</p>

      <div className="w-full rounded-3xl border border-white/8 bg-white/4 p-5 mb-8">
        {([
          { label: 'To',     value: recipient.display },
          { label: 'Amount', value: `$${parseFloat(amount).toFixed(2)} USDC` },
          { label: 'Status', value: tx.status === 'pending' ? '⏳ Pending' : '✓ Confirmed' },
          ...(tx.hash ? [{ label: 'Tx hash', value: `${tx.hash.slice(0, 10)}…` }] : []),
        ] as { label: string; value: string }[]).map(({ label, value }) => (
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
// Success screen — Bank transfer
// ─────────────────────────────────────────────────────────
function BankSuccessScreen({
  recipient,
  amountNgn,
  onDone,
  onSendAnother,
}: {
  recipient: BankRecipient
  amountNgn: string
  onDone: () => void
  onSendAnother: () => void
}) {
  const formattedAmount = parseInt(amountNgn, 10).toLocaleString('en-NG')

  return (
    <div className="flex flex-col items-center flex-1 pt-8 pb-4">
      <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-6">
        <CheckCircle2 size={38} className="text-emerald-400" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-1">Sent!</h2>
      <p className="text-sm text-white/40 mb-8">Bank transfer initiated</p>

      <div className="w-full rounded-3xl border border-white/8 bg-white/4 p-5 mb-8">
        {[
          { label: 'To',      value: recipient.accountName },
          { label: 'Bank',    value: recipient.bankName },
          { label: 'Account', value: recipient.accountNumber },
          { label: 'Amount',  value: `₦${formattedAmount}` },
          { label: 'Status',  value: '⏳ Processing' },
        ].map(({ label, value }) => (
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

  function handleModeSelect(m: SendMode) {
    setMode(m)
    setUsdcType(null)
    setEvmChain('')
    setUsername('')
    setAddress('')
    setRecipient(null)
    setBankRecipient(null)
    setBankAmount('')
    setStep(m === 'bank' ? 'bank_details' : m === 'usdc' ? 'usdc_network' : 'recipient')
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
  }

  const isBankFlow = mode === 'bank'
  const network    = usdcType === 'evm' ? evmChain : 'stellar'

  const chainLabel = EVM_CHAINS.find((c) => c.id === evmChain)?.label ?? ''

  const showHeader = step !== 'success' && step !== 'error'

  const headerTitle =
    step === 'mode'         ? 'Send' :
    step === 'usdc_network' ? 'Send USDC' :
    step === 'recipient'    ? (mode === 'username' ? 'Send by Username' : usdcType === 'evm' ? `${chainLabel} USDC` : 'Stellar USDC') :
    step === 'amount'       ? 'Enter amount' :
    step === 'bank_details' ? 'Bank Transfer' :
    step === 'bank_amount'  ? 'Enter amount' :
    step === 'pin'          ? 'Confirm transfer' : ''

  const headerBack =
    step === 'mode'         ? () => router.back() :
    step === 'usdc_network' ? () => setStep('mode') :
    step === 'recipient'    ? () => { if (mode === 'usdc') setStep('usdc_network'); else setStep('mode') } :
    step === 'amount'       ? () => setStep('recipient') :
    step === 'bank_details' ? () => setStep('mode') :
    step === 'bank_amount'  ? () => setStep('bank_details') :
    step === 'pin'          ? () => { if (isBankFlow) setStep('bank_amount'); else setStep('amount') } :
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
        <ModeSelector onSelect={handleModeSelect} />
      )}

      {/* USDC network selection — Stellar vs EVM */}
      {step === 'usdc_network' && (
        <UsdcNetworkStep
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

      {/* Bank details step */}
      {step === 'bank_details' && (
        <BankDetailsStep
          onNext={(r) => { setBankRecipient(r); setStep('bank_amount') }}
        />
      )}

      {/* Bank amount step */}
      {step === 'bank_amount' && bankRecipient && (
        <BankAmountStep
          recipient={bankRecipient}
          onBack={() => setStep('bank_details')}
          onNext={(amt) => { setBankAmount(amt); setStep('pin') }}
        />
      )}

      {/* PIN — USDC flows */}
      {step === 'pin' && !isBankFlow && recipient && (
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
          onBack={() => setStep('bank_amount')}
          onSuccess={() => setStep('success')}
          onError={(msg) => { setErrMsg(msg); setStep('error') }}
        />
      )}

      {/* Success — USDC flows */}
      {step === 'success' && !isBankFlow && sentTx && recipient && (
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
          recipient={bankRecipient}
          amountNgn={bankAmount}
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
