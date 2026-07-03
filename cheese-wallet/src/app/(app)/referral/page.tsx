'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Copy, CheckCheck, Share2,
  Users, Gift, Clock, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getReferralInfo } from '@/lib/api/wallet'
import { QUERY_KEYS } from '@/constants'
import { notify } from '@/lib/toast'

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
          <Skeleton className="h-6 w-16 rounded-lg" />
          <Skeleton className="h-3 w-12 rounded" />
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

// ── Copy button ────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      notify.error('Could not copy')
    }
  }

  return (
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
      {copied ? <><CheckCheck size={12} /> Copied</> : <><Copy size={12} /> {label}</>}
    </button>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function ReferralPage() {
  const referralQ = useQuery({
    queryKey: QUERY_KEYS.REFERRAL,
    queryFn:  getReferralInfo,
    staleTime: 60_000,
    retry: 1,
  })

  const data    = referralQ.data
  const loading = referralQ.isLoading

  async function handleShare() {
    if (!data?.link) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Cheese Pay',
          text: 'I use Cheese Pay to send and receive USDC instantly. Join with my link and we both earn!',
          url: data.link,
        })
      } catch {
        // user dismissed share sheet — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(data.link)
        notify.success('Link copied to clipboard')
      } catch {
        notify.error('Could not share link')
      }
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
        <h1 className="text-lg font-semibold text-white tracking-tight">Refer & Earn</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">

        {/* Hero card */}
        <div
          className="rounded-3xl overflow-hidden p-6 flex flex-col gap-2"
          style={{
            background: 'linear-gradient(135deg, #1c1600 0%, #1a1400 50%, #0f0d00 100%)',
            border: '1px solid rgba(212,168,67,0.2)',
          }}
        >
          <div className="flex items-center justify-between">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,168,67,0.12)' }}
            >
              <Gift size={18} className="text-[#d4a843]" />
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(212,168,67,0.12)', color: '#d4a843' }}
            >
              $2 per referral
            </span>
          </div>

          <div className="mt-2">
            <p className="text-2xl font-bold text-white leading-tight">
              Invite friends,<br />earn USDC
            </p>
            <p className="text-sm text-white/45 mt-2 leading-relaxed">
              For every friend who signs up with your code and completes their first transaction,
              you both earn <span className="text-[#d4a843] font-medium">$2.00 USDC</span> instantly.
            </p>
          </div>

          {/* Total earned highlight */}
          {!loading && data && (
            <div
              className="mt-3 px-4 py-3 rounded-2xl flex items-center justify-between"
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.12)' }}
            >
              <span className="text-xs text-white/40 uppercase tracking-widest font-medium">Total earned</span>
              <span className="text-lg font-bold text-[#d4a843]">
                ${parseFloat(String(data.paidReward)).toFixed(2)}
                <span className="text-xs font-normal text-[#d4a843]/60 ml-1">USDC</span>
              </span>
            </div>
          )}
          {loading && <Skeleton className="h-12 w-full rounded-2xl mt-3" />}
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <StatCard
            label="Friends invited"
            value={loading ? '—' : String(data?.totalReferrals ?? 0)}
            icon={Users}
            iconColor="text-sky-400"
            iconBg="bg-sky-400/10"
            loading={loading}
          />
          <StatCard
            label="Pending"
            value={loading ? '—' : `$${parseFloat(String(data?.pendingReward ?? 0)).toFixed(2)}`}
            sub="awaiting first tx"
            icon={Clock}
            iconColor="text-amber-400"
            iconBg="bg-amber-400/10"
            loading={loading}
          />
        </div>

        {/* Referral code card */}
        <div className="rounded-3xl border border-white/8 bg-white/3 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-white/6">
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-3">
              Your referral code
            </p>
            {loading ? (
              <Skeleton className="h-10 w-40 rounded-xl" />
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold tracking-widest text-[#d4a843]">
                  {data?.code ?? '—'}
                </p>
                <CopyBtn text={data?.code ?? ''} label="Copy code" />
              </div>
            )}
          </div>

          <div className="px-5 py-4">
            <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-3">
              Share link
            </p>
            {loading ? (
              <Skeleton className="h-9 w-full rounded-xl" />
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-xs text-white/40 font-mono truncate flex-1 min-w-0">
                  {data?.link ?? '—'}
                </p>
                <CopyBtn text={data?.link ?? ''} label="Copy" />
              </div>
            )}
          </div>
        </div>

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          disabled={loading || !data}
          className="w-full h-13 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-black transition-all disabled:opacity-40"
          style={{ background: '#d4a843', height: '52px' }}
        >
          <Share2 size={16} />
          Share with friends
        </button>

        {/* How it works */}
        <div className="rounded-3xl border border-white/8 bg-white/3 p-5">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-4">
            How it works
          </p>
          <div className="flex flex-col gap-4">
            {[
              {
                step: '1',
                title: 'Share your code',
                desc: 'Send your referral code or link to a friend.',
              },
              {
                step: '2',
                title: 'Friend signs up',
                desc: 'They create a Cheese Pay account using your code.',
              },
              {
                step: '3',
                title: 'Both of you earn',
                desc: 'Once they complete their first transaction, you each get $2 USDC in your wallet.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'rgba(212,168,67,0.12)', border: '1px solid rgba(212,168,67,0.2)', color: '#d4a843' }}
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

        {/* History link */}
        <Link
          href="/history"
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors"
        >
          <div>
            <p className="text-sm text-white font-medium">Referral bonuses</p>
            <p className="text-xs text-white/35 mt-0.5">View in transaction history</p>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </Link>

      </div>
    </div>
  )
}
