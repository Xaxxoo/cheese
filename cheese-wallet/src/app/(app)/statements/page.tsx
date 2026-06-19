'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { getTransactions } from '@/lib/api/wallet'
import { STALE_TIMES } from '@/constants'
import type { Transaction } from '@/types'

// ── Stack layout constants (mirror the HTML preview) ────────────────────────
const PEEK       = [38, 50, 60, 70]   // px shown for each back card (closest→furthest)
const SCALES     = [0.99, 0.98, 0.97, 0.95]
const ACTIVE_TOP = 8 + PEEK.reduce((a, b) => a + b, 0)  // 226
const STACK_H    = 500                // px — enough for ACTIVE_TOP + card body

// ── Data helpers ─────────────────────────────────────────────────────────────
const CREDIT_TYPES = new Set(['deposit', 'yield_credit', 'referral_bonus'])

interface MonthData {
  key: string           // "2026-01"
  label: string         // "January 2026"
  shortMonth: string    // "JAN"
  shortYear: string     // "2026"
  totalReceived: number // sum of completed credit amounts (NGN)
  txCount: number
}

function buildMonths(txs: Transaction[]): MonthData[] {
  const map = new Map<string, MonthData>()

  for (const tx of txs) {
    const d   = new Date(tx.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    if (!map.has(key)) {
      map.set(key, {
        key,
        label:       d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortMonth:  d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
        shortYear:   String(d.getFullYear()),
        totalReceived: 0,
        txCount: 0,
      })
    }

    const m = map.get(key)!
    m.txCount++

    if (CREDIT_TYPES.has(tx.type) && tx.status === 'completed') {
      m.totalReceived += parseFloat(tx.amountNgn ?? '0') || 0
    }
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function fmtNgn(n: number): string {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Shared inline style tokens ────────────────────────────────────────────────
const GOLD   = '#d4a843'
const GOLD30 = 'rgba(212,168,67,.3)'
const GOLD10 = 'rgba(212,168,67,.1)'

// ── Page ─────────────────────────────────────────────────────────────────────
export default function StatementsPage() {
  const router = useRouter()

  const [activeIdx, setActiveIdx]   = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [flyDir, setFlyDir]         = useState<'left' | 'right' | null>(null)

  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const busy       = useRef(false)
  const initialized = useRef(false)

  // ── Data ────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['statements'],
    queryFn:  () => getTransactions(1, 100),
    staleTime: STALE_TIMES.TRANSACTIONS,
  })

  const months = useMemo(
    () => (data?.items?.length ? buildMonths(data.items) : []),
    [data],
  )

  useEffect(() => {
    if (months.length && !initialized.current) {
      setActiveIdx(months.length - 1)
      initialized.current = true
    }
  }, [months])

  // ── Fly-away animation ───────────────────────────────────────────────────
  function flyAway(dir: 'left' | 'right') {
    if (busy.current || months.length < 2) return
    busy.current = true
    setFlyDir(dir)

    setTimeout(() => {
      const next = (activeIdx + (dir === 'left' ? -1 : 1) + months.length) % months.length
      setFlyDir(null)
      setDragOffset(0)
      setActiveIdx(next)
      busy.current = false
    }, 280)
  }

  // ── Pointer handlers (on active card) ───────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartX.current = e.clientX
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    setDragOffset(e.clientX - dragStartX.current)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isDragging.current) return
    isDragging.current = false
    const dx = e.clientX - dragStartX.current
    if (Math.abs(dx) > 40) flyAway(dx < 0 ? 'left' : 'right')
    else setDragOffset(0)
  }

  function onPointerCancel() {
    isDragging.current = false
    setDragOffset(0)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-semibold text-white">Statements</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="sm" />
        </div>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (!months.length) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex items-center gap-3 px-4 pt-5 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-semibold text-white">Statements</h1>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 px-6 mt-24 text-center">
          <div className="w-20 h-20 rounded-full bg-[#d4a843]/10 flex items-center justify-center mb-5">
            <FileText size={32} className="text-[#d4a843]" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No statements yet</h2>
          <p className="text-sm text-white/40 leading-relaxed max-w-xs">
            Monthly statements will appear here once you have activity on your account.
          </p>
        </div>
      </div>
    )
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  const total = months.length

  return (
    <div className="flex flex-col pb-8">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              Your Bank Statements
            </h1>
            <p className="text-[11px] text-white/30 mt-0.5">
              {months[0].label} – {months[total - 1].label.split(' ')[0]}
              {' · '}
              {total} statement{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div
          className="px-3 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1"
          style={{
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.09)',
            color: 'rgba(255,255,255,.5)',
          }}
        >
          {months[0].shortYear} ▾
        </div>
      </div>

      {/* Card stack */}
      <div
        className="relative mx-4"
        style={{ height: STACK_H, overflow: 'hidden' }}
      >
        {months.map((m, i) => {
          const behind  = ((activeIdx - i) % total + total) % total
          const isActive = behind === 0

          if (behind > PEEK.length) return null

          // ── Compute position ──────────────────────────────────────────
          let cumPeek = 0
          if (!isActive) {
            for (let b = 1; b <= behind; b++) {
              cumPeek += PEEK[Math.min(b - 1, PEEK.length - 1)]
            }
          }
          const cardTop = isActive ? ACTIVE_TOP : ACTIVE_TOP - cumPeek
          const scale   = isActive ? 1 : SCALES[Math.min(behind - 1, SCALES.length - 1)]
          const peekH   = isActive ? 0 : PEEK[Math.min(behind - 1, PEEK.length - 1)]
          const zIdx    = isActive ? 10 : PEEK.length + 1 - behind

          // ── Transform & transition ────────────────────────────────────
          let transform  = `scale(${scale})`
          let transition = 'top .38s cubic-bezier(.32,1.42,.56,1), transform .38s cubic-bezier(.32,1.42,.56,1), opacity .3s ease'
          let opacity    = 1

          if (isActive) {
            if (flyDir) {
              const sign = flyDir === 'left' ? -1 : 1
              transform  = `translateX(${sign * 130}%) rotate(${sign * 10}deg)`
              transition = 'transform .28s cubic-bezier(.4,0,.6,1), opacity .25s ease'
              opacity    = 0
            } else if (dragOffset !== 0) {
              transform  = `translateX(${dragOffset}px) rotate(${dragOffset * 0.04}deg)`
              transition = 'none'
            } else {
              transform = 'scale(1)'
            }
          }

          return (
            <div
              key={m.key}
              style={{
                position: 'absolute', left: 0, right: 0,
                top: cardTop,
                zIndex: zIdx,
                transform,
                transition,
                opacity,
                cursor: isActive ? 'grab' : 'pointer',
              }}
              onClick={() => { if (!isActive && !busy.current) setActiveIdx(i) }}
              {...(isActive ? {
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerCancel,
              } : {})}
            >
              {/* Card surface */}
              <div style={{
                background: 'linear-gradient(160deg,#2a2212 0%,#1f1a0c 100%)',
                border: `1px solid ${isActive ? GOLD30 : GOLD10}`,
                borderBottom: isActive ? undefined : 'none',
                borderRadius: isActive ? '22px' : '18px 18px 0 0',
                boxShadow: isActive
                  ? '0 20px 60px rgba(0,0,0,.65),0 8px 20px rgba(0,0,0,.4),0 0 50px rgba(212,168,67,.05),inset 0 1px 0 rgba(255,255,255,.04)'
                  : '0 6px 18px rgba(0,0,0,.45)',
              }}>

                {/* ── Collapsed strip (back cards) ── */}
                {!isActive && (
                  <div style={{
                    height: peekH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      letterSpacing: '.07em', textTransform: 'uppercase',
                      color: 'rgba(255,255,255,.38)',
                    }}>
                      {m.label}
                    </span>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      border: '1.5px solid rgba(212,168,67,.16)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: '1px dashed rgba(212,168,67,.12)',
                      }} />
                    </div>
                  </div>
                )}

                {/* ── Expanded body (active card) ── */}
                {isActive && (
                  <div style={{ padding: '20px 20px 26px', position: 'relative' }}>
                    {/* Stamp */}
                    <div style={{
                      position: 'absolute', top: 20, right: 16,
                      width: 54, height: 54, borderRadius: '50%',
                      border: '1.5px solid rgba(212,168,67,.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: '50%',
                        border: '1px dashed rgba(212,168,67,.14)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 7, fontWeight: 700, letterSpacing: '.05em',
                        color: 'rgba(212,168,67,.28)',
                        textAlign: 'center', lineHeight: 1.4,
                      }}>
                        {m.shortMonth}<br />{m.shortYear}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 8.5, fontWeight: 700, letterSpacing: '.16em',
                      textTransform: 'uppercase', color: 'rgba(212,168,67,.4)', marginBottom: 4,
                    }}>
                      Statement
                    </div>

                    <div style={{
                      fontSize: 22, fontWeight: 800, color: 'white',
                      textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4,
                    }}>
                      {m.label}
                    </div>

                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.26)' }}>
                      {m.txCount} transaction{m.txCount !== 1 ? 's' : ''}
                    </div>

                    <div style={{
                      height: 1, background: 'rgba(255,255,255,.05)', margin: '18px 0',
                    }} />

                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '.16em',
                      textTransform: 'uppercase', color: 'rgba(212,168,67,.45)', marginBottom: 7,
                    }}>
                      Total Received
                    </div>

                    <div style={{
                      fontSize: 36, fontWeight: 800, color: GOLD,
                      letterSpacing: -1, lineHeight: 1,
                    }}>
                      {m.totalReceived > 0 ? fmtNgn(m.totalReceived) : '—'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom hint */}
      <div className="flex flex-col items-center gap-1.5 pt-5">
        <div style={{
          fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 18, height: 1, background: 'rgba(255,255,255,.08)', display: 'inline-block' }} />
          swipe or tap to browse
          <span style={{ width: 18, height: 1, background: 'rgba(255,255,255,.08)', display: 'inline-block' }} />
        </div>
        <div style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '.12em',
          color: 'rgba(255,255,255,.18)',
        }}>
          Total Received
        </div>
      </div>
    </div>
  )
}
