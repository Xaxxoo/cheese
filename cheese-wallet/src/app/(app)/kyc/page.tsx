'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Fingerprint, CreditCard, Loader2,
  BadgeCheck, ChevronRight, Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { initiateBvn, completeBvn, initiateNin, completeNin } from '@/lib/api/wallet'
import { notify } from '@/lib/toast'

type IdType = 'bvn' | 'nin'
type Step = 'choose' | 'enter-id' | 'enter-otp' | 'success'

export default function KycPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [step, setStep] = useState<Step>('choose')
  const [idType, setIdType] = useState<IdType>('bvn')
  const [idNumber, setIdNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [error, setError] = useState('')

  const otpRef = useRef<HTMLInputElement>(null)

  // Auto-focus OTP input when entering OTP step
  useEffect(() => {
    if (step === 'enter-otp') otpRef.current?.focus()
  }, [step])

  // If already verified, show success state
  if (user?.kycStatus === 'verified') {
    return (
      <div className="flex flex-col pb-8">
        <Header />
        <SuccessView onDone={() => router.push('/profile')} />
      </div>
    )
  }

  // ── Step 1: Initiate ─────────────────────────────────────
  const initiateMut = useMutation({
    mutationFn: async () => {
      if (idType === 'bvn') return initiateBvn(idNumber)
      return initiateNin(idNumber)
    },
    onSuccess: (result) => {
      setSessionId(result.sessionId)
      setMaskedPhone(result.maskedPhone)
      setError('')
      setStep('enter-otp')
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to initiate verification. Please try again.')
    },
  })

  // ── Step 2: Complete ─────────────────────────────────────
  const completeMut = useMutation({
    mutationFn: async () => {
      if (idType === 'bvn') return completeBvn(sessionId, otp)
      return completeNin(sessionId, otp)
    },
    onSuccess: () => {
      updateUser({ kycStatus: 'verified' })
      notify.success('Identity verified successfully!')
      setError('')
      setStep('success')
    },
    onError: (err: Error) => {
      setError(err.message || 'Verification failed. Please check the OTP and try again.')
    },
  })

  const isSubmitting = initiateMut.isPending || completeMut.isPending
  const idValid = /^\d{11}$/.test(idNumber)
  const otpValid = otp.length >= 4

  return (
    <div className="flex flex-col pb-8">
      <Header />

      <div className="px-4 mt-2">
        {/* ── Choose ID type ─────────────────────────── */}
        {step === 'choose' && (
          <div className="flex flex-col gap-4 mt-4">
            <p className="text-sm text-white/50 leading-relaxed">
              Verify your identity to unlock transfers, earn yield, and more.
              Choose your preferred verification method below.
            </p>

            <button
              onClick={() => { setIdType('bvn'); setStep('enter-id') }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 transition-all group"
            >
              <div className="w-11 h-11 rounded-full bg-[#d4a843]/10 flex items-center justify-center flex-shrink-0">
                <CreditCard size={18} className="text-[#d4a843]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">BVN Verification</p>
                <p className="text-xs text-white/40 mt-0.5">Bank Verification Number (11 digits)</p>
              </div>
              <ChevronRight size={16} className="text-white/20 group-hover:text-white/40 transition-colors" />
            </button>

            <button
              onClick={() => { setIdType('nin'); setStep('enter-id') }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 transition-all group"
            >
              <div className="w-11 h-11 rounded-full bg-[#d4a843]/10 flex items-center justify-center flex-shrink-0">
                <Fingerprint size={18} className="text-[#d4a843]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">NIN Verification</p>
                <p className="text-xs text-white/40 mt-0.5">National Identification Number (11 digits)</p>
              </div>
              <ChevronRight size={16} className="text-white/20 group-hover:text-white/40 transition-colors" />
            </button>
          </div>
        )}

        {/* ── Enter ID number ────────────────────────── */}
        {step === 'enter-id' && (
          <div className="flex flex-col gap-5 mt-4">
            <button
              onClick={() => { setStep('choose'); setIdNumber(''); setError('') }}
              className="text-xs text-white/40 hover:text-white/60 transition-colors self-start flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Change method
            </button>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2 block">
                {idType === 'bvn' ? 'BVN' : 'NIN'} Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                placeholder={`Enter your 11-digit ${idType.toUpperCase()}`}
                value={idNumber}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '')
                  setIdNumber(v)
                  setError('')
                }}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d4a843]/40 focus:ring-1 focus:ring-[#d4a843]/20 transition-all tracking-widest font-mono"
                autoFocus
              />
              <p className="text-[11px] text-white/30 mt-2">
                An OTP will be sent to the phone number registered with your {idType.toUpperCase()}.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/8 border border-red-400/15 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              disabled={!idValid || isSubmitting}
              onClick={() => initiateMut.mutate()}
              className={cn(
                'w-full py-3.5 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                idValid && !isSubmitting
                  ? 'bg-[#d4a843] text-black hover:bg-[#c49b3a]'
                  : 'bg-white/8 text-white/25 cursor-not-allowed',
              )}
            >
              {initiateMut.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Sending OTP...</>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}

        {/* ── Enter OTP ──────────────────────────────── */}
        {step === 'enter-otp' && (
          <div className="flex flex-col gap-5 mt-4">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#d4a843]/8 border border-[#d4a843]/15">
              <Smartphone size={18} className="text-[#d4a843] flex-shrink-0" />
              <p className="text-xs text-white/60 leading-relaxed">
                We sent a verification code to <span className="text-white font-medium">{maskedPhone}</span>
              </p>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider font-medium mb-2 block">
                Enter OTP
              </label>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter the code"
                value={otp}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '')
                  setOtp(v)
                  setError('')
                }}
                className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#d4a843]/40 focus:ring-1 focus:ring-[#d4a843]/20 transition-all tracking-[0.35em] font-mono text-center text-lg"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/8 border border-red-400/15 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              disabled={!otpValid || isSubmitting}
              onClick={() => completeMut.mutate()}
              className={cn(
                'w-full py-3.5 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                otpValid && !isSubmitting
                  ? 'bg-[#d4a843] text-black hover:bg-[#c49b3a]'
                  : 'bg-white/8 text-white/25 cursor-not-allowed',
              )}
            >
              {completeMut.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Verifying...</>
              ) : (
                'Verify'
              )}
            </button>

            <button
              onClick={() => {
                setOtp('')
                setError('')
                initiateMut.mutate()
              }}
              disabled={initiateMut.isPending}
              className="text-xs text-white/35 hover:text-white/55 transition-colors self-center"
            >
              {initiateMut.isPending ? 'Resending...' : "Didn't receive a code? Resend"}
            </button>
          </div>
        )}

        {/* ── Success ────────────────────────────────── */}
        {step === 'success' && (
          <SuccessView onDone={() => router.push('/profile')} />
        )}
      </div>
    </div>
  )
}

// ── Shared components ──────────────────────────────────────

function Header() {
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-4">
      <Link
        href="/profile"
        className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
      >
        <ArrowLeft size={16} />
      </Link>
      <h1 className="text-base font-semibold text-white">Verify Identity</h1>
    </div>
  )
}

function SuccessView({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 mt-16 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-400/10 flex items-center justify-center mb-5">
        <BadgeCheck size={36} className="text-emerald-400" />
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">
        Identity Verified
      </h2>
      <p className="text-sm text-white/45 leading-relaxed max-w-xs mb-8">
        Your identity has been verified. You now have full access to transfers, yield, and more.
      </p>

      <button
        onClick={onDone}
        className="px-6 py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49b3a] transition-all"
      >
        Back to Profile
      </button>
    </div>
  )
}
