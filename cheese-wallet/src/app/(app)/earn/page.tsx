'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, TrendingUp, Zap, RefreshCw,
  ChevronRight, Layers, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getEarnBalance } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Stat card ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  loading,
}: {
  label: string
  value: string
  sub?: string
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
          <Skeleton className="h-6 w-20 rounded-lg" />
          <Skeleton className="h-3 w-14 rounded" />
        </>
      ) : (
        <>
          <p className="text-xl font-bold text-white leading-none">{value}</p>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">{label}</p>
            {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function EarnPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: QUERY_KEYS.EARN_BALANCE,
    queryFn:  getEarnBalance,
    staleTime: STALE_TIMES.EARN,
    retry: 1,
  })

  const fmt = (n: number) => `$${n.toFixed(2)}`

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

        {/* Hero card */}
        <div
          className="rounded-3xl overflow-hidden p-6 flex flex-col gap-2"
          style={{
            background: 'linear-gradient(135deg, #001a0f 0%, #00150b 50%, #000f08 100%)',
            border: '1px solid rgba(52,211,153,0.18)',
          }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(52,211,153,0.12)' }}
            >
              <TrendingUp size={18} className="text-emerald-400" />
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20 rounded-full" />
            ) : data ? (
              <span
                className="text-sm font-bold px-3 py-1 rounded-full"
                style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
              >
                {data.apy.toFixed(1)}% APY
              </span>
            ) : null}
          </div>

          <div className="mt-2">
            <p className="text-2xl font-bold text-white leading-tight">
              Your USDC<br />earns while it sits
            </p>
            <p className="text-sm text-white/45 mt-2 leading-relaxed">
              Your balance automatically earns yield every day through{' '}
              {isLoading ? 'DeFi protocols' : (
                <span className="text-emerald-400 font-medium">{data?.protocol ?? 'DeFi protocols'}</span>
              )}
              . No lock-ups, no minimums.
            </p>
          </div>

          {/* Total earned highlight */}
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-2xl mt-3" />
          ) : data ? (
            <div
              className="mt-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.12)' }}
            >
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-medium mb-1">
                Balance earning yield
              </p>
              <p className="text-2xl font-bold text-emerald-400 leading-none">
                {fmt(data.balance)}
                <span className="text-sm font-normal text-emerald-400/60 ml-1.5">USDC</span>
              </p>
            </div>
          ) : null}
        </div>

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-white/30">Could not load earn data</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-3">
          <StatCard
            label="Earned this month"
            value={isLoading ? '—' : fmt(data?.earnedMonth ?? 0)}
            icon={Zap}
            iconColor="text-amber-400"
            iconBg="bg-amber-400/10"
            loading={isLoading}
          />
          <StatCard
            label="Total earned"
            value={isLoading ? '—' : fmt(data?.earnedTotal ?? 0)}
            sub="all time"
            icon={TrendingUp}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-400/10"
            loading={isLoading}
          />
        </div>

        {/* Protocol details card */}
        <div className="rounded-3xl border border-white/8 bg-white/3 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-3">
              Protocol details
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/50">
                  <Layers size={14} />
                  <span className="text-xs">Protocol</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-4 w-20 rounded" />
                ) : (
                  <span className="text-xs font-medium text-white">{data?.protocol ?? '—'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/50">
                  <RotateCcw size={14} />
                  <span className="text-xs">Compounding</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-4 w-16 rounded" />
                ) : (
                  <span className="text-xs font-medium text-white capitalize">{data?.compounding ?? '—'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/50">
                  <TrendingUp size={14} />
                  <span className="text-xs">Current APY</span>
                </div>
                {isLoading ? (
                  <Skeleton className="h-4 w-12 rounded" />
                ) : (
                  <span className="text-xs font-bold text-emerald-400">
                    {data?.apy != null ? `${data.apy.toFixed(1)}%` : '—'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs text-white/30 leading-relaxed">
              Yield is accrued daily and credited to your wallet. Rates are variable and
              subject to market conditions. No fees are charged on yield earnings.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
            How it works
          </p>
          <div className="flex flex-col gap-4">
            {[
              {
                step: '1',
                title: 'Hold USDC',
                desc: 'Simply keep USDC in your Cheese Pay wallet — no action needed.',
              },
              {
                step: '2',
                title: 'Earn daily yield',
                desc: 'Your balance is deployed into curated DeFi protocols earning competitive APY.',
              },
              {
                step: '3',
                title: 'Auto-credited',
                desc: 'Yield is credited to your wallet automatically. Withdraw anytime.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.2)',
                    color: '#34d399',
                  }}
                >
                  {step}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{title}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Yield history link */}
        <Link
          href="/history"
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="text-sm text-white font-medium">Yield history</p>
            <p className="text-xs text-white/35 mt-0.5">View yield credits in transaction history</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </Link>

      </div>
    </div>
  )
}
