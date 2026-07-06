'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Snowflake, Eye, EyeOff, Copy,
  CheckCheck, Lock, ShieldCheck, RefreshCw,
  CreditCard, TrendingUp, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getCard, freezeCard, unfreezeCard, revealCvv, getCardTransactions } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { VirtualCard } from '@/types'
import { notify } from '@/lib/toast'
import { PinPad } from '@/components/ui/PinPad'

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Mastercard logo ────────────────────────────────────────
function MastercardLogo() {
  return (
    <div className="flex items-center">
      <div className="w-7 h-7 rounded-full bg-red-500 opacity-90" />
      <div className="w-7 h-7 rounded-full bg-amber-400 opacity-90 -ml-3.5" />
    </div>
  )
}

// ── Physical card visual ───────────────────────────────────
function CardVisual({ card }: { card: VirtualCard }) {
  const isFrozen = card.status === 'frozen'

  return (
    <div
      className="relative mx-4 rounded-3xl overflow-hidden select-none"
      style={{
        aspectRatio: '1.586',
        background: isFrozen
          ? 'linear-gradient(135deg, #1a2535 0%, #0f1824 50%, #0a1520 100%)'
          : 'linear-gradient(135deg, #1a1200 0%, #151000 50%, #1c1500 100%)',
        border: isFrozen
          ? '1px solid rgba(96,165,250,0.25)'
          : '1px solid rgba(212,168,67,0.25)',
        boxShadow: isFrozen
          ? '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(96,165,250,0.1)'
          : '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,168,67,0.1)',
      }}
    >
      {/* Subtle chip art */}
      <div
        className="absolute"
        style={{
          top: '28%', left: '6%',
          width: '13%', aspectRatio: '1.4',
          borderRadius: '4px',
          background: isFrozen
            ? 'linear-gradient(135deg, #334155, #1e293b)'
            : 'linear-gradient(135deg, #b8860b, #8b6914)',
          border: isFrozen ? '1px solid rgba(96,165,250,0.15)' : '1px solid rgba(212,168,67,0.3)',
        }}
      />

      {/* Frozen overlay */}
      {isFrozen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-blue-950/30 backdrop-blur-[1px]">
          <Snowflake size={28} className="text-blue-400 opacity-60" />
          <span className="text-xs text-blue-300/70 font-medium tracking-widest uppercase">Frozen</span>
        </div>
      )}

      {/* Top row: label + network */}
      <div className="absolute top-0 left-0 right-0 px-5 pt-4 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: isFrozen ? 'rgba(148,163,184,0.6)' : 'rgba(212,168,67,0.7)' }}>
          Cheese Pay
        </span>
        <MastercardLogo />
      </div>

      {/* Card number */}
      <div className="absolute bottom-[38%] left-0 right-0 px-5">
        <p className="text-base font-mono tracking-[0.22em] text-white/80">
          {card.maskedNumber}
        </p>
      </div>

      {/* Bottom row: name + expiry */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] text-white/35 uppercase tracking-widest mb-0.5">Card Holder</p>
          <p className="text-xs font-semibold text-white/80 tracking-wide uppercase">
            {card.holderName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/35 uppercase tracking-widest mb-0.5">Expires</p>
          <p className="text-xs font-semibold text-white/80">{card.expiry}</p>
        </div>
      </div>
    </div>
  )
}

// ── CVV reveal modal ───────────────────────────────────────
function CvvModal({ onClose }: { onClose: () => void }) {
  const [pin, setPin]       = useState('')
  const [cvv, setCvv]       = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [error, setError]   = useState('')

  const mutation = useMutation({
    mutationFn: () => revealCvv(pin),
    onSuccess: (data) => {
      setCvv(data.cvv)
      setCountdown(60)
    },
    onError: () => {
      setError('Incorrect PIN. Try again.')
      setPin('')
    },
  })

  // Countdown timer once CVV is revealed
  useEffect(() => {
    if (!cvv) return
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); onClose(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [cvv, onClose])

  useEffect(() => {
    if (pin.length === 6 && !mutation.isPending) mutation.mutate()
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[430px] rounded-t-3xl flex flex-col"
        style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {!cvv ? (
          <div className="px-6 pb-10 pt-2 flex flex-col gap-6">
            <div className="text-center">
              <p className="text-base font-semibold text-white">Enter your PIN</p>
              <p className="text-xs text-white/40 mt-1">Required to reveal your CVV</p>
            </div>
            <PinPad
              value={pin}
              onChange={(v) => { setPin(v); setError('') }}
              label=""
              error={error}
            />
            {mutation.isPending && (
              <p className="text-xs text-white/40 text-center">Verifying…</p>
            )}
          </div>
        ) : (
          <div className="px-6 pb-10 pt-4 flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-base font-semibold text-white">Your CVV</p>
              <p className="text-xs text-white/40 mt-1">Hides in {countdown}s</p>
            </div>
            <div
              className="w-full rounded-2xl flex items-center justify-between px-6 py-5"
              style={{ background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)' }}
            >
              <p className="text-4xl font-bold tracking-widest text-[#d4a843]">
                {visible ? cvv : '•••'}
              </p>
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Countdown ring */}
            <div className="flex items-center gap-2 text-xs text-white/30">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: countdown > 15 ? '#4ade80' : '#f87171' }}
              />
              Auto-hides in {countdown} seconds
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-2xl bg-white/8 text-white/60 text-sm font-medium hover:bg-white/12 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card locked state ──────────────────────────────────────
function CardLocked({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
        <Lock size={26} className="text-white/25" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/60">Card Locked</p>
        <p className="text-xs text-white/30 mt-2 leading-relaxed max-w-[260px]">{message}</p>
      </div>
      <Link
        href="/kyc"
        className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors inline-flex items-center gap-1"
      >
        Complete verification <ChevronRight size={12} />
      </Link>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function CardPage() {
  const qc = useQueryClient()
  const [showCvv, setShowCvv]         = useState(false)
  const [copiedNum, setCopiedNum]     = useState(false)
  const [lockMsg, setLockMsg]         = useState<string | null>(null)

  const cardQ = useQuery({
    queryKey: QUERY_KEYS.CARD,
    queryFn:  getCard,
    staleTime: STALE_TIMES.CARD,
    retry: false, // 403s should not be retried
  })

  // Capture lock message from 403 errors
  useEffect(() => {
    if (cardQ.isError) {
      const err = cardQ.error as { response?: { data?: { message?: string } } }
      const msg = err?.response?.data?.message ?? 'Card not available'
      setLockMsg(msg)
    }
  }, [cardQ.isError, cardQ.error])

  const freezeMut = useMutation({
    mutationFn: freezeCard,
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEYS.CARD, data)
      notify.success('Card frozen')
    },
    onError: () => notify.error('Could not freeze card'),
  })

  const unfreezeMut = useMutation({
    mutationFn: unfreezeCard,
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEYS.CARD, data)
      notify.success('Card unfrozen')
    },
    onError: () => notify.error('Could not unfreeze card'),
  })

  async function copyNumber() {
    const card = cardQ.data
    if (!card) return
    try {
      await navigator.clipboard.writeText(card.maskedNumber.replace(/•/g, '*'))
      setCopiedNum(true)
      setTimeout(() => setCopiedNum(false), 2000)
    } catch {
      notify.error('Could not copy')
    }
  }

  const card = cardQ.data
  const isFrozen = card?.status === 'frozen'
  const freezePending = freezeMut.isPending || unfreezeMut.isPending

  const spendPct = card
    ? Math.min(100, (parseFloat(card.monthlySpend) / parseFloat(card.spendLimit)) * 100)
    : 0

  const handleCloseCvv = useCallback(() => setShowCvv(false), [])

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
        <h1 className="text-lg font-semibold text-white tracking-tight flex-1">My Card</h1>
        {card && (
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            isFrozen ? 'bg-blue-400/12 text-blue-400' : 'bg-emerald-400/12 text-emerald-400',
          )}>
            {isFrozen ? <Snowflake size={11} /> : <ShieldCheck size={11} />}
            {isFrozen ? 'Frozen' : 'Active'}
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {cardQ.isLoading && (
        <div className="flex flex-col gap-4 px-4">
          <div className="bg-white/8 rounded-3xl animate-pulse" style={{ aspectRatio: '1.586' }} />
          <div className="flex gap-3">
            <Skeleton className="flex-1 h-12 rounded-2xl" />
            <Skeleton className="flex-1 h-12 rounded-2xl" />
            <Skeleton className="flex-1 h-12 rounded-2xl" />
          </div>
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      )}

      {/* Locked / error state */}
      {cardQ.isError && lockMsg && <CardLocked message={lockMsg} />}

      {/* Card loaded */}
      {card && (
        <>
          {/* Card visual */}
          <CardVisual card={card} />

          {/* Action buttons */}
          <div className="flex gap-2.5 px-4 mt-4">
            {/* Freeze / Unfreeze */}
            <button
              type="button"
              onClick={() => isFrozen ? unfreezeMut.mutate() : freezeMut.mutate()}
              disabled={freezePending}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-xs font-medium transition-all disabled:opacity-50',
                isFrozen
                  ? 'bg-blue-400/8 border-blue-400/20 text-blue-400 hover:bg-blue-400/12'
                  : 'bg-white/5 border-white/8 text-white/60 hover:bg-white/8 hover:text-white',
              )}
            >
              {freezePending
                ? <RefreshCw size={18} className="animate-spin" />
                : <Snowflake size={18} />
              }
              {isFrozen ? 'Unfreeze' : 'Freeze'}
            </button>

            {/* Copy masked number */}
            <button
              type="button"
              onClick={copyNumber}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-white/8 bg-white/5 text-xs font-medium text-white/60 hover:bg-white/8 hover:text-white transition-all"
            >
              {copiedNum ? <CheckCheck size={18} className="text-emerald-400" /> : <Copy size={18} />}
              {copiedNum ? 'Copied' : 'Copy'}
            </button>

            {/* Reveal CVV */}
            <button
              type="button"
              onClick={() => setShowCvv(true)}
              disabled={isFrozen}
              className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-white/8 bg-white/5 text-xs font-medium text-white/60 hover:bg-white/8 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Eye size={18} />
              CVV
            </button>
          </div>

          {/* Stats card */}
          <div className="mx-4 mt-4 rounded-3xl border border-white/8 bg-white/3 p-5 flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Balance',    value: `$${parseFloat(card.availableBalance).toFixed(2)}`, color: 'text-emerald-400' },
                { label: 'Spent',      value: `$${parseFloat(card.monthlySpend).toFixed(2)}`,    color: 'text-white' },
                { label: 'Limit',      value: `$${parseFloat(card.spendLimit).toFixed(0)}`,      color: 'text-[#d4a843]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center gap-1 bg-white/4 rounded-2xl py-3">
                  <p className={cn('text-base font-bold', color)}>{value}</p>
                  <p className="text-[9px] text-white/35 uppercase tracking-widest font-medium">{label}</p>
                </div>
              ))}
            </div>

            {/* Monthly spend bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">Monthly spend</span>
                <span className="text-[10px] text-white/40">{spendPct.toFixed(0)}% of limit</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${spendPct}%`,
                    background: spendPct > 80 ? '#f87171' : spendPct > 50 ? '#fbbf24' : '#d4a843',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card transactions */}
          <CardTransactions />
        </>
      )}

      {/* CVV modal */}
      {showCvv && <CvvModal onClose={handleCloseCvv} />}
    </div>
  )
}

// ── Card transactions ──────────────────────────────────────
function CardTransactions() {
  const txQ = useQuery({
    queryKey: QUERY_KEYS.CARD_TRANSACTIONS,
    queryFn:  getCardTransactions,
    staleTime: STALE_TIMES.CARD,
    retry: 1,
  })

  return (
    <section className="px-2 mt-6">
      <div className="flex items-center justify-between px-2 mb-2">
        <h2 className="text-sm font-semibold text-white/60 tracking-wide">Card transactions</h2>
      </div>

      {txQ.isLoading && (
        <div className="flex flex-col gap-1 px-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <div className="w-10 h-10 rounded-full bg-white/8 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-32 bg-white/8 rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-white/8 rounded animate-pulse" />
              </div>
              <div className="h-3 w-14 bg-white/8 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {txQ.isSuccess && txQ.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
            <CreditCard size={18} className="text-white/20" />
          </div>
          <p className="text-xs text-white/30">No card transactions yet</p>
        </div>
      )}

      {txQ.isSuccess && txQ.data.length > 0 && (
        <div className="flex flex-col">
          {txQ.data.map(tx => (
            <div
              key={tx.id}
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
            >
              <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                <CreditCard size={16} className="text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">
                  {tx.description ?? 'Card Payment'}
                </p>
                <p className="text-xs text-white/35 mt-0.5">
                  {new Date(tx.createdAt).toLocaleDateString('en-NG', {
                    month: 'short', day: 'numeric',
                  })}
                  {' · '}
                  {new Date(tx.createdAt).toLocaleTimeString('en-NG', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-white shrink-0">
                -${parseFloat(tx.amountUsdc).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}

      {txQ.isError && (
        <div className="flex items-center gap-2 px-4 py-4">
          <TrendingUp size={14} className="text-white/20" />
          <p className="text-xs text-white/30">Could not load card transactions</p>
        </div>
      )}
    </section>
  )
}
