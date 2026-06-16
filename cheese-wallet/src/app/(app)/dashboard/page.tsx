'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight, ArrowDownLeft, Link2, Eye, EyeOff,
  TrendingUp, RefreshCw, Copy, CheckCheck, Receipt, FileText,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { getBalance, getTransactions, getWalletAddress } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { Transaction } from '@/types'
import { notify } from '@/lib/toast'
import { TransactionSheet } from '@/components/TransactionSheet'

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
  )
}

// ── Balance card ──────────────────────────────────────────
function BalanceCard() {
  const [hidden, setHidden] = useState(false)
  const [copied, setCopied] = useState(false)
  const { user } = useAuthStore()

  const balanceQ = useQuery({
    queryKey: QUERY_KEYS.BALANCE,
    queryFn:  getBalance,
    staleTime: STALE_TIMES.BALANCE,
    retry: 1,
  })

  const addressQ = useQuery({
    queryKey: QUERY_KEYS.ADDRESS,
    queryFn:  getWalletAddress,
    staleTime: STALE_TIMES.PROFILE,
    retry: 1,
  })

  async function copyAddress() {
    const addr = addressQ.data?.stellarAddress
    if (!addr) return
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify.error('Could not copy address')
    }
  }

  const usdcDisplay = balanceQ.data
    ? (balanceQ.data.totalUsdcDisplay ?? `$${parseFloat(balanceQ.data.totalUsdc ?? '0').toFixed(2)}`)
    : null

  const ngnDisplay = balanceQ.data?.ngnEquivalent ?? null

  return (
    <div className="mx-4 mt-4 rounded-3xl overflow-hidden" style={{
      background: 'linear-gradient(135deg, #1a1a1a 0%, #141414 50%, #1c1a12 100%)',
      border: '1px solid rgba(212,168,67,0.12)',
    }}>
      {/* Top section */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-white/40 tracking-widest uppercase font-medium mb-1">Total Balance</p>
            {balanceQ.isLoading ? (
              <>
                <Skeleton className="h-9 w-40 rounded-lg mb-1" />
                <Skeleton className="h-4 w-24 rounded-md" />
              </>
            ) : balanceQ.isError ? (
              <div>
                <p className="text-2xl font-semibold text-white/30">—</p>
                <p className="text-xs text-red-400/70 mt-0.5">Could not load balance</p>
              </div>
            ) : (
              <div>
                <p className="text-[2rem] font-semibold text-white leading-none">
                  {hidden ? '••••••' : usdcDisplay}
                  <span className="text-base text-white/40 ml-1.5">USDC</span>
                </p>
                <p className="text-sm text-white/40 mt-1">
                  {hidden ? '₦ ••••••' : (ngnDisplay ?? '—')}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
          >
            {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {/* Deposit address */}
        {addressQ.data && (
          <button
            type="button"
            onClick={copyAddress}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl bg-white/5 border border-white/8 hover:bg-white/8 transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-white/30 shrink-0">Stellar</span>
              <span className="text-xs text-white/50 font-mono truncate">
                {addressQ.data.stellarAddress.slice(0, 10)}…{addressQ.data.stellarAddress.slice(-6)}
              </span>
            </div>
            {copied
              ? <CheckCheck size={14} className="text-emerald-400 shrink-0" />
              : <Copy size={14} className="text-white/30 shrink-0" />
            }
          </button>
        )}
      </div>

      {/* Action row */}
      <div className="flex border-t border-white/6 overflow-x-auto no-scrollbar">
        {[
          { label: 'Send',       icon: ArrowUpRight,  href: '/send',        color: 'text-[#d4a843]' },
          { label: 'Receive',    icon: ArrowDownLeft, href: '/receive',     color: 'text-emerald-400' },
          { label: 'Pay Link',   icon: Link2,         href: '/paylink',     color: 'text-violet-400' },
          { label: 'Pay Bills',  icon: Receipt,       href: '/bills',       color: 'text-amber-400' },
          { label: 'Statements', icon: FileText,      href: '/statements',  color: 'text-sky-400' },
        ].map(({ label, icon: Icon, href, color }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1.5 py-4 hover:bg-white/5 transition-colors flex-1 min-w-[64px]"
          >
            <div className={cn('w-9 h-9 rounded-full flex items-center justify-center bg-white/8', color)}>
              <Icon size={16} />
            </div>
            <span className="text-[11px] text-white/50 whitespace-nowrap">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Transaction row ───────────────────────────────────────
function TxRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const isIn = tx.type === 'deposit' || tx.type === 'yield_credit' || tx.type === 'referral_bonus'
  const sign = isIn ? '+' : '-'
  const color = isIn ? 'text-emerald-400' : 'text-white'

  const typeLabel: Record<string, string> = {
    send_username:  'Sent',
    send_address:   'Sent',
    bank_transfer:  'Bank Transfer',
    withdrawal:     'Withdrawal',
    deposit:        'Deposit',
    yield_credit:   'Yield',
    referral_bonus: 'Referral Bonus',
    card_payment:   'Card Payment',
    fee:            'Fee',
    pay_request:    'Pay Request',
    bill_payment:   'Bill Payment',
  }

  const statusColor: Record<string, string> = {
    pending:  'bg-amber-400/15 text-amber-400',
    failed:   'bg-red-400/15 text-red-400',
    reversed: 'bg-orange-400/15 text-orange-400',
  }

  const subtitle = tx.recipientUsername ?? tx.recipientAddress ?? tx.bank ?? null

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 active:bg-white/6 transition-colors rounded-2xl text-left"
    >
      <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0 text-lg">
        {isIn ? '↓' : '↑'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">
          {typeLabel[tx.type] ?? tx.type}
          {subtitle && (
            <span className="text-white/40 font-normal"> · {subtitle}</span>
          )}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-white/35">
            {new Date(tx.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
            {' · '}
            {new Date(tx.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {tx.status !== 'completed' && statusColor[tx.status] && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', statusColor[tx.status])}>
              {tx.status}
            </span>
          )}
        </div>
      </div>
      <p className={cn('text-sm font-semibold tabular-nums shrink-0', color)}>
        {sign}${parseFloat(tx.amountUsdc).toFixed(2)}
      </p>
    </button>
  )
}

// ── Transactions section ──────────────────────────────────
function RecentTransactions() {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const txQ = useQuery({
    queryKey: QUERY_KEYS.TRANSACTIONS(1),
    queryFn:  () => getTransactions(1, 5),
    staleTime: STALE_TIMES.TRANSACTIONS,
    retry: 1,
  })

  return (
    <section className="px-2 mt-6">
      <div className="flex items-center justify-between px-2 mb-3">
        <h2 className="text-sm font-semibold text-white/70 tracking-wide">Recent activity</h2>
        {txQ.isSuccess && txQ.data.totalPages > 1 && (
          <Link href="/history" className="text-xs text-[#d4a843]/80 hover:text-[#d4a843] transition-colors">
            See all
          </Link>
        )}
      </div>

      {txQ.isLoading && (
        <div className="flex flex-col gap-1">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 px-2 py-3.5">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-2.5 w-20 rounded" />
              </div>
              <Skeleton className="h-3.5 w-14 rounded" />
            </div>
          ))}
        </div>
      )}

      {txQ.isError && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-white/30">Could not load transactions</p>
          <button
            type="button"
            onClick={() => txQ.refetch()}
            className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {txQ.isSuccess && txQ.data.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
            <TrendingUp size={22} className="text-white/25" />
          </div>
          <div>
            <p className="text-sm text-white/40 font-medium">No transactions yet</p>
            <p className="text-xs text-white/25 mt-1">Send or receive USDC to get started</p>
          </div>
        </div>
      )}

      {txQ.isSuccess && txQ.data.items.length > 0 && (
        <div className="flex flex-col">
          {txQ.data.items.map(tx => (
            <TxRow key={tx.id} tx={tx} onClick={() => setSelectedTx(tx)} />
          ))}
        </div>
      )}

      <TransactionSheet tx={selectedTx} onClose={() => setSelectedTx(null)} />
    </section>
  )
}

// ── Rate ticker ───────────────────────────────────────────
function RateTicker() {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.EXCHANGE_RATE,
    queryFn:  async () => {
      const { getExchangeRate } = await import('@/lib/api/wallet')
      return getExchangeRate()
    },
    staleTime: STALE_TIMES.EXCHANGE_RATE,
    retry: 1,
  })

  if (!data) return null

  return (
    <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-between">
      <span className="text-xs text-white/40">1 USDC</span>
      <span className="text-xs text-white font-medium">
        ₦{Number(data.effectiveRate).toLocaleString('en-NG', { minimumFractionDigits: 0 })}
      </span>
      <span className="text-[10px] text-white/25">Live rate</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore()

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col pb-4">
      {/* Greeting */}
      <div className="px-6 pt-5 pb-1">
        <p className="text-sm text-white/40">
          {greeting}{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </p>
      </div>

      <BalanceCard />
      <RateTicker />
      <RecentTransactions />
    </div>
  )
}
