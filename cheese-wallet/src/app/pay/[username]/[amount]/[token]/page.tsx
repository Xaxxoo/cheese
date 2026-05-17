'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CheckCheck, AlertTriangle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { resolvePayLink, payPayLink } from '@/lib/api/wallet'
import { useAuthStore } from '@/store/authStore'
import { hashPin, signDeviceChallenge } from '@/lib/crypto/deviceSigning'

// ── PIN input ──────────────────────────────────────────────
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-3 h-3 rounded-full transition-all',
            i < value.length ? 'bg-[#d4a843]' : 'bg-white/15',
          )}
        />
      ))}
    </div>
  )
}

function PinPad({ onPress }: { onPress: (k: string) => void }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  return (
    <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] mx-auto">
      {keys.map((k, i) => (
        k === '' ? <div key={i} /> :
        <button
          key={i}
          type="button"
          onClick={() => onPress(k)}
          className="h-14 rounded-2xl bg-white/8 text-white text-xl font-medium hover:bg-white/14 active:scale-95 transition-all"
        >
          {k}
        </button>
      ))}
    </div>
  )
}

// ── Status display ─────────────────────────────────────────
function StatusBanner({ status }: { status: string }) {
  if (status === 'paid') return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-sky-400/10 border border-sky-400/20 px-4 py-3">
      <CheckCheck size={16} className="text-sky-400 shrink-0" />
      <p className="text-sm text-sky-300">This link has already been paid.</p>
    </div>
  )
  if (status === 'expired') return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white/6 border border-white/10 px-4 py-3">
      <Clock size={16} className="text-white/40 shrink-0" />
      <p className="text-sm text-white/50">This payment link has expired.</p>
    </div>
  )
  if (status === 'cancelled') return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-red-400/10 border border-red-400/20 px-4 py-3">
      <XCircle size={16} className="text-red-400 shrink-0" />
      <p className="text-sm text-red-300">This link has been cancelled by the creator.</p>
    </div>
  )
  return null
}

// ── Success screen ─────────────────────────────────────────
function SuccessScreen({ amountUsdc }: { amountUsdc: string }) {
  return (
    <div className="flex flex-col items-center gap-5 py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-400/15 flex items-center justify-center">
        <CheckCheck size={28} className="text-emerald-400" />
      </div>
      <div>
        <p className="text-xl font-bold text-white">Payment Sent!</p>
        <p className="text-sm text-white/50 mt-1">
          ${parseFloat(amountUsdc).toFixed(2)} USDC has been sent successfully.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-2 px-6 py-3 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function PayLinkPage() {
  const params   = useParams()
  const router   = useRouter()
  const token    = params.token as string

  const { user, deviceId } = useAuthStore()

  const [pin, setPin]           = useState('')
  const [done, setDone]         = useState(false)
  const [paidAmount, setPaidAmt] = useState('')
  const [error, setError]       = useState('')

  const linkQ = useQuery({
    queryKey: ['paylink', token],
    queryFn:  () => resolvePayLink(token),
    retry: 1,
    enabled: !!token,
  })

  const payMut = useMutation({
    mutationFn: async (pinValue: string) => {
      if (!user || !deviceId) throw new Error('Not logged in')
      const [pinHash, deviceSignature] = await Promise.all([
        hashPin(pinValue, user.id),
        signDeviceChallenge(deviceId),
      ])
      return payPayLink(token, { pinHash, deviceId, deviceSignature })
    },
    onSuccess: (res) => {
      setPaidAmt(res.amountUsdc)
      setDone(true)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: unknown } } })
        ?.response?.data?.message ?? 'Payment failed'
      const text = Array.isArray(msg) ? msg.join(', ') : String(msg)
      setError(text)
      setPin('')
      toast.error(text)
    },
  })

  function handleKey(k: string) {
    if (payMut.isPending) return
    setError('')
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const next = pin + k
    setPin(next)
    if (next.length === 6) payMut.mutate(next)
  }

  const link = linkQ.data
  const isActive = link?.status === 'pending'
  const isOwn    = user && link && link.creator.username === user.username

  if (done) return (
    <main className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <SuccessScreen amountUsdc={paidAmount} />
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Logo */}
        <p className="text-center text-[#d4a843] font-bold text-lg tracking-tight mb-2">
          cheese<span className="text-white">pay</span>
        </p>

        {/* Loading */}
        {linkQ.isLoading && (
          <div className="rounded-3xl border border-white/8 bg-white/3 p-8 flex flex-col items-center gap-3">
            <RefreshCw size={20} className="text-white/30 animate-spin" />
            <p className="text-sm text-white/30">Loading payment details…</p>
          </div>
        )}

        {/* Error loading */}
        {linkQ.isError && (
          <div className="rounded-3xl border border-white/8 bg-white/3 p-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={20} className="text-amber-400" />
            <p className="text-sm text-white/60">Payment link not found or invalid.</p>
            <button
              type="button"
              onClick={() => linkQ.refetch()}
              className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {/* Link details */}
        {link && (
          <div className="rounded-3xl border border-white/8 bg-white/3 p-6 flex flex-col gap-4">
            {/* Amount */}
            <div className="text-center">
              <p className="text-4xl font-bold text-white tabular-nums">
                ${parseFloat(link.amountUsdc).toFixed(2)}
              </p>
              <p className="text-sm text-white/40 mt-1">USDC</p>
            </div>

            {/* Creator */}
            <div className="text-center">
              <p className="text-sm text-white/50">
                Requested by{' '}
                <span className="text-white font-medium">
                  {link.creator.fullName || `@${link.creator.username}`}
                </span>
                {link.creator.fullName && (
                  <span className="text-white/30"> @{link.creator.username}</span>
                )}
              </p>
            </div>

            {/* Note */}
            {link.note && (
              <div className="rounded-xl bg-white/5 px-4 py-2.5 text-center">
                <p className="text-sm text-white/70 italic">"{link.note}"</p>
              </div>
            )}

            {/* Expiry */}
            {isActive && (
              <p className="text-[11px] text-white/25 text-center">
                Expires {new Date(link.expiresAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            )}

            {/* Status banner for non-active */}
            {!isActive && <StatusBanner status={link.status} />}
          </div>
        )}

        {/* Own link warning */}
        {isOwn && isActive && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-amber-400/8 border border-amber-400/20 px-4 py-3">
            <AlertTriangle size={15} className="text-amber-400 shrink-0" />
            <p className="text-xs text-amber-200/80">
              You can't pay your own payment link.
            </p>
          </div>
        )}

        {/* Not logged in */}
        {!user && link && isActive && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}
              className="w-full py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49938] transition-colors"
            >
              Log in to Pay
            </button>
            <Link
              href="/signup"
              className="w-full py-3 rounded-2xl border border-white/10 text-white/60 text-sm text-center hover:bg-white/5 transition-colors"
            >
              Create a Cheese Pay account
            </Link>
          </div>
        )}

        {/* PIN entry */}
        {user && !isOwn && link && isActive && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/3 p-5">
              <p className="text-xs text-white/40 text-center uppercase tracking-widest">
                Enter your PIN to pay
              </p>
              <PinDots value={pin} />
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}
              {payMut.isPending && (
                <p className="text-xs text-white/30 text-center flex items-center justify-center gap-1.5">
                  <RefreshCw size={11} className="animate-spin" /> Processing…
                </p>
              )}
            </div>
            <PinPad onPress={handleKey} />
          </div>
        )}

      </div>
    </main>
  )
}
