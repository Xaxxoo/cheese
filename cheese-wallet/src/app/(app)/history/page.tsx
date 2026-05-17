'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowUpRight, ArrowDownLeft, Building2,
  RefreshCw, TrendingUp, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/cn'
import { getTransactions, syncBankTransferStatus } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { Transaction } from '@/types'

type TxType = Transaction['type']

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Tx row ─────────────────────────────────────────────────
const TX_ICON_CFG: Record<TxType, { icon: React.ElementType; color: string }> = {
  send_username:  { icon: ArrowUpRight,  color: 'text-white/60' },
  send_address:   { icon: ArrowUpRight,  color: 'text-white/60' },
  bank_transfer:  { icon: Building2,     color: 'text-sky-400' },
  withdrawal:     { icon: Building2,     color: 'text-sky-400' },
  deposit:        { icon: ArrowDownLeft, color: 'text-emerald-400' },
  yield_credit:   { icon: ArrowDownLeft, color: 'text-emerald-400' },
  referral_bonus: { icon: ArrowDownLeft, color: 'text-emerald-400' },
  card_payment:   { icon: ArrowUpRight,  color: 'text-white/60' },
  fee:            { icon: ArrowUpRight,  color: 'text-white/60' },
  pay_request:    { icon: ArrowUpRight,  color: 'text-white/60' },
}

const TX_LABELS: Record<TxType, string> = {
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
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-amber-400/15 text-amber-400',
  failed:   'bg-red-400/15 text-red-400',
  reversed: 'bg-orange-400/15 text-orange-400',
}

function TxRow({ tx, onSync }: { tx: Transaction; onSync?: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const isIn = tx.type === 'deposit' || tx.type === 'yield_credit' || tx.type === 'referral_bonus'
  const amountColor = isIn ? 'text-emerald-400' : 'text-white'
  const cfg = TX_ICON_CFG[tx.type] ?? TX_ICON_CFG.deposit
  const Icon = cfg.icon
  const subtitle = tx.recipientUsername ?? tx.recipientAddress ?? tx.bank ?? null
  const isPendingBankTransfer = tx.type === 'bank_transfer' && tx.status === 'pending'

  async function handleSync(e: React.MouseEvent) {
    e.stopPropagation()
    if (syncing || !tx.reference) return
    setSyncing(true)
    try {
      const result = await syncBankTransferStatus(tx.reference)
      if (result.synced) {
        toast.success('Transfer status updated')
        onSync?.()
      } else {
        toast('Transfer is still processing', { icon: '⏳' })
      }
    } catch {
      toast.error('Could not sync transfer status')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 transition-colors rounded-2xl">
      <div className={cn('w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0', cfg.color)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">
          {TX_LABELS[tx.type] ?? tx.type}
          {subtitle && <span className="text-white/40 font-normal"> · {subtitle}</span>}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-white/35">
            {new Date(tx.createdAt).toLocaleDateString('en-NG', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
          {tx.status !== 'completed' && STATUS_COLORS[tx.status] && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[tx.status])}>
              {tx.status}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isPendingBankTransfer && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            title="Check transfer status"
            className="w-7 h-7 rounded-full flex items-center justify-center text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10 transition-all disabled:opacity-40"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          </button>
        )}
        <p className={cn('text-sm font-semibold tabular-nums', amountColor)}>
          {isIn ? '+' : '-'}${parseFloat(tx.amountUsdc).toFixed(2)}
        </p>
      </div>
    </div>
  )
}

// ── Filters ────────────────────────────────────────────────
type Filter = 'all' | 'sent' | 'received' | 'withdrawal'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'sent',       label: 'Sent' },
  { id: 'received',   label: 'Received' },
  { id: 'withdrawal', label: 'Bank' },
]

function applyFilter(txs: Transaction[], filter: Filter): Transaction[] {
  switch (filter) {
    case 'sent':       return txs.filter(t => t.type === 'send_username' || t.type === 'send_address' || t.type === 'bank_transfer' || t.type === 'card_payment' || t.type === 'fee' || t.type === 'pay_request')
    case 'received':   return txs.filter(t => t.type === 'deposit' || t.type === 'yield_credit' || t.type === 'referral_bonus')
    case 'withdrawal': return txs.filter(t => t.type === 'withdrawal' || t.type === 'bank_transfer')
    default:           return txs
  }
}

function groupByDate(txs: Transaction[]): { date: string; txs: Transaction[] }[] {
  const groups: { date: string; txs: Transaction[] }[] = []
  for (const tx of txs) {
    const d = new Date(tx.createdAt).toLocaleDateString('en-NG', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last?.date === d) last.txs.push(tx)
    else groups.push({ date: d, txs: [tx] })
  }
  return groups
}

// ── Page ───────────────────────────────────────────────────
export default function HistoryPage() {
  const qc = useQueryClient()
  const [filter,      setFilter]      = useState<Filter>('all')
  const [allTxs,      setAllTxs]      = useState<Transaction[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages,  setTotalPages]  = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  function handleSync() {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS(1) })
  }

  const txQ = useQuery({
    queryKey: QUERY_KEYS.TRANSACTIONS(1),
    queryFn:  () => getTransactions(1, 20),
    staleTime: STALE_TIMES.TRANSACTIONS,
    retry: 1,
  })

  useEffect(() => {
    if (txQ.data) {
      setAllTxs(txQ.data.items)
      setTotalPages(txQ.data.totalPages)
      setCurrentPage(1)
    }
  }, [txQ.data])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const next = currentPage + 1
      const res  = await getTransactions(next, 20)
      setAllTxs(prev => [...prev, ...res.items])
      setTotalPages(res.totalPages)
      setCurrentPage(next)
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false)
    }
  }

  const displayed = applyFilter(allTxs, filter)
  const grouped   = groupByDate(displayed)

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Transaction History</h1>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all',
              filter === f.id
                ? 'bg-[#d4a843] text-black'
                : 'bg-white/8 text-white/50 hover:bg-white/12 hover:text-white',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {txQ.isLoading && (
        <div className="flex flex-col gap-1 px-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-36 rounded" />
                <Skeleton className="h-2.5 w-24 rounded" />
              </div>
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {txQ.isError && (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <p className="text-sm text-white/30">Could not load transactions</p>
          <button
            type="button"
            onClick={() => txQ.refetch()}
            className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {txQ.isSuccess && displayed.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
          <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
            <TrendingUp size={22} className="text-white/25" />
          </div>
          <div>
            <p className="text-sm text-white/40 font-medium">
              {filter === 'all' ? 'No transactions yet' : `No ${filter} transactions`}
            </p>
            {filter === 'all' && (
              <p className="text-xs text-white/25 mt-1">Send or receive USDC to get started</p>
            )}
          </div>
        </div>
      )}

      {/* Tx list grouped by date */}
      {txQ.isSuccess && displayed.length > 0 && (
        <div className="flex flex-col px-2">
          {grouped.map(({ date, txs }) => (
            <div key={date}>
              <p className="text-xs text-white/30 font-medium px-4 pt-4 pb-1.5">{date}</p>
              {txs.map(tx => <TxRow key={tx.id} tx={tx} onSync={handleSync} />)}
            </div>
          ))}

          {currentPage < totalPages && filter === 'all' && (
            <div className="flex justify-center mt-5 px-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white/8 text-white/60 text-sm hover:bg-white/12 hover:text-white transition-all disabled:opacity-40"
              >
                {loadingMore
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <ChevronDown size={14} />
                }
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
