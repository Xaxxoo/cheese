'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, BadgeCheck, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { verifyBvn, verifyNin } from '@/lib/api/wallet'
import { notify } from '@/lib/toast'

type Method = 'bvn' | 'nin'

export default function KycPage() {
  const router = useRouter()
  const { updateUser } = useAuthStore()
  const [method, setMethod] = useState<Method | null>(null)
  const [value, setValue] = useState('')
  const [verified, setVerified] = useState(false)

  const mutation = useMutation({
    mutationFn: (id: string) =>
      method === 'bvn' ? verifyBvn(id) : verifyNin(id),
    onSuccess: (res) => {
      updateUser({ kycStatus: 'verified', tier: res.tier as 'silver' | 'gold' | 'black' })
      setVerified(true)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Verification failed. Please check the number and try again.'
      notify.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.length !== 11) return
    mutation.mutate(value)
  }

  // ── Success state ──────────────────────────────────────
  if (verified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-400/15 flex items-center justify-center mb-5">
          <BadgeCheck size={38} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Identity Verified</h2>
        <p className="text-sm text-white/40 mb-8 max-w-xs">
          Your account is now verified. You can send money and make bank transfers.
        </p>
        <button
          type="button"
          onClick={() => router.replace('/profile')}
          className="px-8 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold"
        >
          Back to Profile
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Verify Identity</h1>
      </div>

      <p className="px-4 text-sm text-white/40 mb-6">
        Verify your identity to unlock sending money and bank transfers.
      </p>

      {/* Method picker */}
      {!method && (
        <div className="mx-4 flex flex-col gap-3">
          {(['bvn', 'nin'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className="flex items-center justify-between w-full bg-white/5 border border-white/8 rounded-2xl px-4 py-4 hover:bg-white/8 transition-colors"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-white">{m.toUpperCase()}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {m === 'bvn'
                    ? 'Bank Verification Number'
                    : 'National Identification Number'}
                </p>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      )}

      {/* Input form */}
      {method && (
        <form onSubmit={handleSubmit} className="mx-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              {method.toUpperCase()} Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="Enter 11-digit number"
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#d4a843]/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={value.length !== 11 || mutation.isPending}
            className="w-full py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold disabled:opacity-40 transition-opacity"
          >
            {mutation.isPending ? 'Verifying…' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => { setMethod(null); setValue('') }}
            className="text-sm text-white/30 hover:text-white/60 transition-colors text-center"
          >
            Use a different method
          </button>
        </form>
      )}
    </div>
  )
}
