'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Copy, CheckCheck, RefreshCw,
  Building2, Wallet, Info, ChevronRight, TrendingUp, Clock, CircleCheck, CircleX,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui/Spinner'
import { getVirtualAccount, getExchangeRate, getOnRampAvailability, getDeposits } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import { notify } from '@/lib/toast'
type BankDeposit = Awaited<ReturnType<typeof getDeposits>>['items'][number]

// ── Copy row ──────────────────────────────────────────────
function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify.error('Could not copy')
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/6 last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0 mr-3">
        <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">
          {label}
        </span>
        <span className={cn('text-sm text-white font-medium truncate', mono && 'font-mono tracking-wide')}>
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
          copied
            ? 'bg-emerald-400/12 text-emerald-400'
            : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white',
        )}
      >
        {copied
          ? <><CheckCheck size={12} /> Copied</>
          : <><Copy size={12} /> Copy</>
        }
      </button>
    </div>
  )
}

// ── Deposit helpers ───────────────────────────────────────
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
}

function DepositStatusPill({ status }: { status: BankDeposit['status'] }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/12 text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        Pending
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/12 text-emerald-400">
        <CircleCheck size={10} />
        Completed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-400/12 text-red-400">
      <CircleX size={10} />
      Failed
    </span>
  )
}

function DepositRow({ deposit }: { deposit: BankDeposit }) {
  const amountNgn  = Number(deposit.amountNgn).toLocaleString('en-NG', { minimumFractionDigits: 0 })
  const amountUsdc = Number(deposit.amountUsdc).toFixed(2)
  const sender     = deposit.senderName ?? 'Unknown sender'
  const time       = formatRelativeTime(deposit.createdAt)
  const shortHash  = deposit.txHash ? deposit.txHash.slice(0, 8) + '…' + deposit.txHash.slice(-4) : null

  return (
    <div className="flex items-start justify-between py-3.5 border-b border-white/6 last:border-0">
      <div className="flex flex-col gap-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white">
            ₦{amountNgn}
          </span>
          <span className="text-white/30 text-xs">→</span>
          <span className="text-sm font-semibold text-emerald-400">
            ${amountUsdc} USDC
          </span>
          <DepositStatusPill status={deposit.status} />
        </div>
        <p className="text-xs text-white/40 truncate">
          {sender} · {time}
        </p>
        {deposit.status === 'completed' && shortHash && (
          <p className="text-[10px] text-white/25 font-mono">{shortHash}</p>
        )}
        {deposit.status === 'failed' && deposit.failureReason && (
          <p className="text-[10px] text-red-400/70">{deposit.failureReason}</p>
        )}
      </div>
    </div>
  )
}

function RecentDeposits() {
  const depositsQ = useQuery({
    queryKey: QUERY_KEYS.DEPOSITS(1),
    queryFn: () => getDeposits(1, 10),
    staleTime: 15_000,
    refetchInterval: (query) => {
      const hasPending = query.state.data?.items.some(d => d.status === 'pending') ?? false
      return hasPending ? 15_000 : false
    },
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-white/40" />
          <span className="text-xs text-white/40 uppercase tracking-widest font-medium">Recent Deposits</span>
        </div>
        {depositsQ.isError && (
          <button
            type="button"
            onClick={() => depositsQ.refetch()}
            className="flex items-center gap-1 text-[11px] text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
          >
            <RefreshCw size={10} /> Retry
          </button>
        )}
      </div>

      {/* Card */}
      <div className="rounded-3xl border border-white/8 bg-white/3 overflow-hidden">
        {/* Loading skeletons */}
        {depositsQ.isLoading && (
          <div className="px-5 py-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="py-3.5 border-b border-white/6 last:border-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 bg-white/8 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-white/8 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-white/8 rounded animate-pulse" />
                </div>
                <div className="h-3 w-36 bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {depositsQ.isError && !depositsQ.isLoading && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-white/30">Could not load deposits</p>
          </div>
        )}

        {/* Empty state */}
        {depositsQ.data && depositsQ.data.items.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-white/30">
              No deposits yet — transfers to the account above appear here
            </p>
          </div>
        )}

        {/* Deposit rows */}
        {depositsQ.data && depositsQ.data.items.length > 0 && (
          <div className="px-5 py-1">
            {depositsQ.data.items.map(deposit => (
              <DepositRow key={deposit.id} deposit={deposit} />
            ))}
          </div>
        )}
      </div>

      {/* Footer: see all in history */}
      {depositsQ.data && depositsQ.data.total > 10 && (
        <Link
          href="/history"
          className="flex items-center justify-center gap-1.5 text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors py-1"
        >
          See all in History
          <ChevronRight size={12} />
        </Link>
      )}
    </div>
  )
}

// ── Bank Transfer tab ─────────────────────────────────────
function BankTransferTab() {
  const [copiedAll, setCopiedAll] = useState(false)
  const [ngnInput, setNgnInput] = useState('')

  const accountQ = useQuery({
    queryKey: QUERY_KEYS.VIRTUAL_ACCOUNT,
    queryFn:  getVirtualAccount,
    staleTime: STALE_TIMES.PROFILE,
    retry:    1,
  })

  const rateQ = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  getExchangeRate,
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry:    1,
  })

  const availabilityQ = useQuery({
    queryKey: QUERY_KEYS.ONRAMP_AVAILABILITY,
    queryFn:  getOnRampAvailability,
    staleTime: 60_000,
    retry:    1,
  })

  const rate = rateQ.data ? Number(rateQ.data.effectiveRate) : null

  const estimatedUsdc =
    rate && ngnInput && !isNaN(parseFloat(ngnInput))
      ? (parseFloat(ngnInput) / rate).toFixed(2)
      : null

  async function copyAll() {
    if (!accountQ.data) return
    const text =
      `Bank: Pulse MFB\nAccount Number: ${accountQ.data.accountNumber}\nAccount Name: ${accountQ.data.accountName}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      notify.error('Could not copy')
    }
  }

  if (accountQ.isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Spinner size="md" />
        <p className="text-sm text-white/30">Setting up your account…</p>
      </div>
    )
  }

  if (accountQ.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center">
          <Building2 size={22} className="text-red-400" />
        </div>
        <div>
          <p className="text-sm text-white/60 font-medium">Could not load account</p>
          <p className="text-xs text-white/30 mt-1">Check your connection and try again</p>
        </div>
        <button
          type="button"
          onClick={() => accountQ.refetch()}
          className="flex items-center gap-1.5 text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    )
  }

  const account = accountQ.data!

  return (
    <div className="flex flex-col gap-4">

      {/* Availability banner */}
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-semibold">Available to buy</p>
          {availabilityQ.isLoading ? (
            <div className="h-5 w-28 bg-white/8 rounded animate-pulse mt-1" />
          ) : availabilityQ.data ? (
            <p className="text-lg font-semibold text-emerald-400 leading-tight">
              {availabilityQ.data.availableUsdcDisplay}
              <span className="text-sm font-normal text-emerald-400/60 ml-1">USDC</span>
            </p>
          ) : (
            <p className="text-sm text-white/30 mt-0.5">Unavailable</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-full bg-emerald-400/10 flex items-center justify-center">
          <TrendingUp size={16} className="text-emerald-400" />
        </div>
      </div>

      {/* Account details card */}
      <div className="rounded-3xl border border-white/8 bg-white/3 overflow-hidden">
        {/* Card header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-white/6">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-medium">
              Your Deposit Account
            </p>
            <p className="text-sm text-white font-semibold mt-0.5">Pulse MFB</p>
          </div>
          <button
            type="button"
            onClick={copyAll}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
              copiedAll
                ? 'bg-emerald-400/12 text-emerald-400'
                : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white',
            )}
          >
            {copiedAll
              ? <><CheckCheck size={12} /> Copied</>
              : <><Copy size={12} /> Copy all</>
            }
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-1">
          <CopyRow label="Bank" value="Pulse MFB" />
          <CopyRow label="Account Number" value={account.accountNumber} mono />
          <CopyRow label="Account Name" value={account.accountName} />
        </div>
      </div>

      {/* Rate + estimator */}
      <div className="rounded-3xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40 uppercase tracking-widest font-medium">Exchange Rate</span>
          {rateQ.isLoading ? (
            <div className="h-4 w-24 bg-white/8 rounded animate-pulse" />
          ) : rate ? (
            <span className="text-sm font-semibold text-[#d4a843]">
              ₦{rate.toLocaleString('en-NG', { minimumFractionDigits: 0 })} = $1 USDC
            </span>
          ) : null}
        </div>

        {/* Estimator */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-white/35 uppercase tracking-widest font-medium">
            How much will you send?
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">₦</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={ngnInput}
              onChange={(e) => setNgnInput(e.target.value)}
              className={cn(
                'w-full h-12 pl-8 pr-4 rounded-2xl border border-white/10 text-sm text-white font-medium',
                'placeholder:text-white/20 focus:outline-none focus:border-[#d4a843]/50 transition-colors',
              )}
              style={{ backgroundColor: '#191919', colorScheme: 'dark' }}
            />
          </div>
          {estimatedUsdc && (
            <p className="text-xs text-white/50 text-right">
              You receive{' '}
              <span className="text-emerald-400 font-semibold">${estimatedUsdc} USDC</span>
            </p>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-[#d4a843]/15 bg-[#d4a843]/4 p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#d4a843] shrink-0" />
          <span className="text-xs text-[#d4a843] font-semibold uppercase tracking-wide">How it works</span>
        </div>
        <ol className="flex flex-col gap-2.5">
          {[
            'Copy the account details above.',
            'Open your bank app and send any NGN amount to this account.',
            'USDC is credited to your Cheese Pay wallet within minutes.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#d4a843]/15 border border-[#d4a843]/20 flex items-center justify-center text-[10px] font-bold text-[#d4a843] mt-0.5">
                {i + 1}
              </span>
              <span className="text-xs text-white/60 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Small print */}
      <p className="text-[11px] text-white/25 text-center leading-relaxed px-2">
        Deposits are converted at the rate shown above.{'\n'}
        The rate may change between when you send and when it settles.
      </p>

      {/* Recent deposits */}
      <RecentDeposits />
    </div>
  )
}

// ── Crypto tab ────────────────────────────────────────────
function CryptoTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-white/8 bg-white/3 p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-400/10 flex items-center justify-center">
            <Wallet size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Stellar (USDC)</p>
            <p className="text-xs text-white/40">Receive USDC directly on Stellar</p>
          </div>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          Send USDC from any Stellar wallet or exchange directly to your Cheese Pay address.
          No minimum deposit.
        </p>
        <Link
          href="/receive"
          className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/6 border border-white/8 hover:bg-white/10 transition-colors"
        >
          <span className="text-sm text-white font-medium">View deposit address</span>
          <ChevronRight size={16} className="text-white/30" />
        </Link>
      </div>

      <div className="rounded-3xl border border-white/8 bg-white/3 p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-violet-400/10 flex items-center justify-center">
            <Wallet size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">EVM chains (USDC + USDT)</p>
            <p className="text-xs text-white/40">Ethereum, Base, Arbitrum, Polygon & Celo</p>
          </div>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          Send USDC or USDT from any EVM-compatible wallet or exchange to your same Cheese Pay EVM address.
        </p>
        <Link
          href="/receive"
          className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/6 border border-white/8 hover:bg-white/10 transition-colors"
        >
          <span className="text-sm text-white font-medium">View deposit addresses</span>
          <ChevronRight size={16} className="text-white/30" />
        </Link>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function AddMoneyPage() {
  const [tab, setTab] = useState<'bank' | 'crypto'>('bank')

  return (
    <div className="flex flex-col pb-10">

      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/60 hover:bg-white/12 hover:text-white transition-all"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold text-white tracking-tight">Add Money</h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex justify-center">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/6 border border-white/8 w-[80%]">
          {([
            { key: 'bank',   label: 'Bank Transfer', icon: Building2 },
            { key: 'crypto', label: 'Crypto',         icon: Wallet    },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                tab === key
                  ? 'bg-[#d4a843] text-black'
                  : 'text-white/50 hover:text-white',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4">
        {tab === 'bank'   && <BankTransferTab />}
        {tab === 'crypto' && <CryptoTab />}
      </div>
    </div>
  )
}
