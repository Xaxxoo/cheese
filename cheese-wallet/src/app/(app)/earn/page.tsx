'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, TrendingUp, Gift, Shield, Clock,
  ChevronRight, RefreshCw, Loader2, Info,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getYieldStatus, enrollYield, unenrollYield, getYieldHistory } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import { notify } from '@/lib/toast'
import type { Transaction } from '@/types'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  loading,
}: {
  label: string
  value: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  loading: boolean
}) {
  return (
    <div className="flex-1 rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col gap-3">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', iconBg)}>
        <Icon size={15} className={iconColor} />
      </div>
      {loading ? (
        <>
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-3 w-12 rounded" />
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-white leading-none">{value}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{label}</p>
        </>
      )}
    </div>
  )
}

export default function EarnPage() {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const statusQ = useQuery({
    queryKey: QUERY_KEYS.YIELD_STATUS,
    queryFn:  getYieldStatus,
    staleTime: STALE_TIMES.YIELD,
    retry: 1,
  })

  const historyQ = useQuery({
    queryKey: QUERY_KEYS.YIELD_HISTORY,
    queryFn:  getYieldHistory,
    staleTime: STALE_TIMES.YIELD,
    retry: 1,
  })

  const enrollM = useMutation({
    mutationFn: enrollYield,
    onSuccess: () => {
      notify.success('Yield earning enabled')
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.YIELD_STATUS })
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      notify.error(err.response?.data?.message ?? 'Failed to enable earning')
    },
  })

  const unenrollM = useMutation({
    mutationFn: unenrollYield,
    onSuccess: () => {
      notify.info('Yield earning disabled')
      setConfirming(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.YIELD_STATUS })
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      notify.error(err.response?.data?.message ?? 'Failed to disable earning')
      setConfirming(false)
    },
  })

  const data    = statusQ.data
  const loading = statusQ.isLoading
  const busy    = enrollM.isPending || unenrollM.isPending

  const tierLabel = data ? data.tier.charAt(0).toUpperCase() + data.tier.slice(1) : ''
  const yieldTxs = (historyQ.data?.items ?? []).slice(0, 10) as Transaction[]

  function handleToggle() {
    if (!data) return
    if (data.enrolled) {
      if (!confirming) {
        setConfirming(true)
        return
      }
      unenrollM.mutate()
    } else {
      enrollM.mutate()
    }
  }

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
        <h1 className="text-lg font-semibold text-white tracking-tight">Earn</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* Error state */}
        {statusQ.isError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-white/30">Could not load yield status</p>
            <button
              type="button"
              onClick={() => statusQ.refetch()}
              className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={12} />
              Try again
            </button>
          </div>
        )}

        {/* Hero APY card */}
        <div
          className="rounded-3xl overflow-hidden p-6 flex flex-col items-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #1c1600 0%, #1a1400 50%, #0f0d00 100%)',
            border: '1px solid rgba(212,168,67,0.2)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(212,168,67,0.12)' }}
          >
            <TrendingUp size={22} className="text-[#d4a843]" />
          </div>

          <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium mt-2">
            Annual Percentage Yield
          </p>

          {loading ? (
            <Skeleton className="h-14 w-32 rounded-xl" />
          ) : (
            <>
              <p className="text-5xl font-bold text-[#d4a843] leading-none tracking-tight">
                {data?.apyRate ?? '0'}%
              </p>
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full mt-1"
                style={{ background: 'rgba(212,168,67,0.12)', color: '#d4a843' }}
              >
                {tierLabel} Tier
              </span>
            </>
          )}

          {/* Total earned highlight */}
          {!loading && data && (
            <div
              className="w-full mt-3 px-4 py-3 rounded-2xl flex items-center justify-between"
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.12)' }}
            >
              <span className="text-xs text-white/40 uppercase tracking-widest font-medium">Total earned</span>
              <span className="text-lg font-bold text-[#d4a843]">
                ${parseFloat(data.totalEarned).toFixed(2)}
                <span className="text-xs font-normal text-[#d4a843]/60 ml-1">USDC</span>
              </span>
            </div>
          )}
          {loading && <Skeleton className="h-12 w-full rounded-2xl mt-3" />}
        </div>

        {/* Toggle button */}
        {!loading && data && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy}
            className={cn(
              'w-full rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all disabled:opacity-50',
              data.enrolled
                ? confirming
                  ? 'bg-red-500/15 text-red-400 border border-red-400/30'
                  : 'bg-[#d4a843] text-black'
                : 'bg-white/3 text-[#d4a843] border border-[#d4a843]/40 hover:bg-[#d4a843]/10',
            )}
            style={{ height: '52px' }}
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : data.enrolled ? (
              confirming ? 'Tap again to disable' : 'Earning Enabled'
            ) : (
              'Enable Earning'
            )}
          </button>
        )}

        {/* Stats row */}
        <div className="flex gap-3">
          <StatCard
            label="Total Earned"
            value={loading ? '—' : `$${parseFloat(data?.totalEarned ?? '0').toFixed(2)}`}
            icon={Gift}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-400/10"
            loading={loading}
          />
          <StatCard
            label="Balance"
            value={loading ? '—' : `$${parseFloat(data?.balanceUsdc ?? '0').toFixed(2)}`}
            icon={Shield}
            iconColor="text-sky-400"
            iconBg="bg-sky-400/10"
            loading={loading}
          />
        </div>

        {/* Last distribution */}
        {!loading && data?.lastDistributionAt && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-white/30">
            <Clock size={12} />
            <span>
              Last credit: {new Date(data.lastDistributionAt).toLocaleDateString('en-NG', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Tier APY breakdown */}
        <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info size={14} className="text-[#d4a843]" />
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">
              How it works
            </p>
          </div>
          <p className="text-xs text-white/40 leading-relaxed mb-4">
            Your USDC earns yield daily through Blend Capital on Stellar.
            Yield is credited to your wallet at 2:00 AM UTC every day.
            {data ? ` A minimum balance of $${data.minBalanceUsdc} USDC is required.` : ''}
          </p>
          <div className="border-t border-white/6 pt-4 flex flex-col gap-3">
            {[
              { tier: 'Silver', apy: '5.0%' },
              { tier: 'Gold',   apy: '5.5%' },
              { tier: 'Black',  apy: '6.0%' },
            ].map(({ tier, apy }) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="text-sm text-white/50">{tier}</span>
                <span className="text-sm font-semibold text-[#d4a843]">{apy} APY</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent yield credits */}
        {historyQ.isSuccess && yieldTxs.length > 0 && (
          <div className="rounded-3xl border border-white/8 bg-white/3 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-white/6">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
                Recent Earnings
              </p>
            </div>
            <div className="flex flex-col">
              {yieldTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-5 py-3.5 border-b border-white/4 last:border-b-0"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
                    <Gift size={14} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">Yield Credit</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-NG', {
                        month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-400 tabular-nums shrink-0">
                    +${parseFloat(tx.amountUsdc).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {historyQ.isSuccess && yieldTxs.length === 0 && data?.enrolled && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-white/6 flex items-center justify-center">
              <TrendingUp size={22} className="text-white/25" />
            </div>
            <div>
              <p className="text-sm text-white/40 font-medium">No earnings yet</p>
              <p className="text-xs text-white/25 mt-1">Your first yield credit will appear here tomorrow</p>
            </div>
          </div>
        )}

        {/* History link */}
        <Link
          href="/history"
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="text-sm text-white font-medium">Yield history</p>
            <p className="text-xs text-white/35 mt-0.5">View all in transaction history</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </Link>

      </div>
    </div>
  )
}
