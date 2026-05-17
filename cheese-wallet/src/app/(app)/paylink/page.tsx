'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Copy, CheckCheck, Link2, X, Plus, RefreshCw, Clock,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { createPayLink, getMyPayLinks, cancelPayLink } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import type { CreatePayLinkResponse, PayLinkData } from '@/types'

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Status badge ───────────────────────────────────────────
function StatusBadge({ status }: { status: PayLinkData['status'] }) {
  const map: Record<PayLinkData['status'], { label: string; cls: string }> = {
    pending:   { label: 'Active',    cls: 'bg-emerald-400/12 text-emerald-400' },
    paid:      { label: 'Paid',      cls: 'bg-sky-400/12 text-sky-400' },
    expired:   { label: 'Expired',   cls: 'bg-white/10 text-white/30' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-400/12 text-red-400' },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cls)}>
      {label}
    </span>
  )
}

// ── Link card ──────────────────────────────────────────────
function LinkCard({
  link,
  onCancel,
}: {
  link: PayLinkData
  onCancel: (token: string) => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const date = new Date(link.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-white">
            ${parseFloat(link.amountUsdc).toFixed(2)} USDC
          </p>
          {link.note && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{link.note}</p>
          )}
          <p className="text-[10px] text-white/25 mt-1">{date}</p>
        </div>
        <StatusBadge status={link.status} />
      </div>

      {link.status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#d4a843]/12 text-[#d4a843] text-xs font-medium hover:bg-[#d4a843]/20 transition-colors"
          >
            {copied ? <><CheckCheck size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
          </button>
          <button
            type="button"
            onClick={() => onCancel(link.token)}
            className="px-3 py-2 rounded-xl bg-white/6 text-white/40 hover:bg-red-400/12 hover:text-red-400 transition-colors"
            title="Cancel link"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Created link banner ────────────────────────────────────
function CreatedBanner({
  result,
  onDismiss,
}: {
  result: CreatePayLinkResponse
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <div className="mx-4 mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-emerald-300">Link created!</p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="rounded-xl bg-black/20 px-3 py-2">
        <p className="text-[11px] text-white/50 font-mono break-all leading-relaxed">{result.url}</p>
      </div>

      <button
        type="button"
        onClick={copy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors"
      >
        {copied
          ? <><CheckCheck size={15} /> Copied!</>
          : <><Copy size={15} /> Copy Payment Link</>
        }
      </button>

      <p className="text-[10px] text-white/30 text-center">
        ${parseFloat(result.amountUsdc).toFixed(4)} USDC
        {result.note ? ` · ${result.note}` : ''}
      </p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function PayLinkPage() {
  const qc = useQueryClient()

  const [amount, setAmount]   = useState('')
  const [note, setNote]       = useState('')
  const [expiry, setExpiry]   = useState('24')
  const [created, setCreated] = useState<CreatePayLinkResponse | null>(null)
  const [error, setError]     = useState('')

  const linksQ = useQuery({
    queryKey: QUERY_KEYS.PAYLINK_MY,
    queryFn:  () => getMyPayLinks(1, 30),
    staleTime: STALE_TIMES.BALANCE,
    retry: 1,
  })

  const createMut = useMutation({
    mutationFn: createPayLink,
    onSuccess: (res) => {
      setCreated(res)
      setAmount('')
      setNote('')
      setExpiry('24')
      setError('')
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PAYLINK_MY })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: unknown } } })
        ?.response?.data?.message ?? 'Failed to create link'
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg))
    },
  })

  const cancelMut = useMutation({
    mutationFn: cancelPayLink,
    onSuccess: () => {
      toast.success('Link cancelled')
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PAYLINK_MY })
    },
    onError: () => toast.error('Could not cancel link'),
  })

  function submit() {
    setError('')
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      setError('Enter a valid USDC amount')
      return
    }
    createMut.mutate({
      amountUsdc:     amt.toFixed(6),
      note:           note.trim() || undefined,
      expiresInHours: parseInt(expiry, 10),
    })
  }

  const links       = linksQ.data?.data ?? []
  const activeLinks = links.filter(l => l.status === 'pending')
  const pastLinks   = links.filter(l => l.status !== 'pending')

  return (
    <div className="flex flex-col pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Payment Link</h1>
      </div>

      {/* Created banner */}
      {created && (
        <CreatedBanner result={created} onDismiss={() => setCreated(null)} />
      )}

      {/* Create form */}
      <div className="mx-4 mb-6 rounded-2xl border border-white/8 bg-white/3 p-4 flex flex-col gap-4">
        <p className="text-xs text-white/50 font-medium uppercase tracking-widest">New Link</p>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40">Amount (USDC)</label>
          <div className="flex items-center gap-2 rounded-xl bg-white/6 border border-white/8 px-3 py-3">
            <span className="text-white/30 text-sm">$</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError('') }}
              className="flex-1 bg-transparent text-white text-sm placeholder-white/20 outline-none"
            />
            <span className="text-xs text-white/30">USDC</span>
          </div>
        </div>

        {/* Note */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40">Note (optional)</label>
          <input
            type="text"
            placeholder="e.g. Payment for design work"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={140}
            className="rounded-xl bg-white/6 border border-white/8 px-3 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Expiry */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/40">Expires in</label>
          <div className="flex gap-2">
            {(['24', '48', '72', '168'] as const).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setExpiry(h)}
                className={cn(
                  'flex-1 py-2 rounded-xl text-xs font-medium transition-all',
                  expiry === h
                    ? 'bg-[#d4a843] text-black'
                    : 'bg-white/6 text-white/50 hover:text-white',
                )}
              >
                {h === '168' ? '7d' : `${h}h`}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={createMut.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors disabled:opacity-50"
        >
          {createMut.isPending
            ? <><RefreshCw size={15} className="animate-spin" /> Creating…</>
            : <><Plus size={15} /> Generate Link</>
          }
        </button>
      </div>

      {/* Active links */}
      {(linksQ.isLoading || activeLinks.length > 0) && (
        <div className="px-4 mb-5">
          <h2 className="text-xs text-white/40 font-medium uppercase tracking-widest mb-3 flex items-center gap-2">
            <Link2 size={12} />
            Active Links
          </h2>

          {linksQ.isLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          )}

          {linksQ.isError && (
            <div className="flex items-center justify-center gap-2 py-4">
              <p className="text-xs text-white/30">Could not load links</p>
              <button
                type="button"
                onClick={() => linksQ.refetch()}
                className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          )}

          {!linksQ.isLoading && !linksQ.isError && activeLinks.length === 0 && (
            <p className="text-xs text-white/25 text-center py-4">No active links</p>
          )}

          <div className="flex flex-col gap-3">
            {activeLinks.map(l => (
              <LinkCard
                key={l.id}
                link={l}
                onCancel={token => cancelMut.mutate(token)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past links */}
      {pastLinks.length > 0 && (
        <div className="px-4">
          <h2 className="text-xs text-white/40 font-medium uppercase tracking-widest mb-3 flex items-center gap-2">
            <Clock size={12} />
            Past Links
          </h2>
          <div className="flex flex-col gap-3">
            {pastLinks.map(l => (
              <LinkCard
                key={l.id}
                link={l}
                onCancel={token => cancelMut.mutate(token)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
