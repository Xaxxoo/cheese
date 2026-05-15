'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { notify } from '@/lib/toast'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { forgotPassword, resetPassword } from '@/lib/api/auth'

type Step = 'email' | 'otp' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const { setBooting } = useAuthStore()

  const [step, setStep]       = useState<Step>('email')
  const [loading, setLoading] = useState(false)
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [newPw, setNewPw]     = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { setBooting(false) }, [setBooting])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(email.trim().toLowerCase())
      setStep('otp')
      notify.success('Reset code sent — check your inbox')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not send reset email')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length < 6) { setError('Enter the 6-digit code'); return }
    if (newPw.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await resetPassword({ email: email.toLowerCase(), otp, newPassword: newPw })
      setStep('done')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Reset failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 -ml-1"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>

      {/* ── Email step ──────────────────────────────────── */}
      {step === 'email' && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Reset your password</h1>
            <p className="text-sm text-white/45">
              Enter your email and we&apos;ll send you a reset code
            </p>
          </div>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              error={error}
              autoCapitalize="none"
              autoComplete="email"
            />
            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              Send reset code
            </Button>
          </form>

          <p className="text-sm text-white/40 text-center mt-auto">
            Remember it?{' '}
            <Link href="/login" className="text-[#d4a843] hover:underline">Sign in</Link>
          </p>
        </div>
      )}

      {/* ── OTP + new password step ──────────────────────── */}
      {step === 'otp' && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Enter reset code</h1>
            <p className="text-sm text-white/45">
              We sent a code to <span className="text-white/70">{email}</span>
            </p>
          </div>

          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g,'').slice(0,6)); setError('') }}
              error={error}
            />
            <Input
              label="New password"
              type={showPw ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              suffix={
                <button type="button" onClick={() => setShowPw(!showPw)} className="text-white/40 hover:text-white/70 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
              Reset password
            </Button>
          </form>
        </div>
      )}

      {/* ── Done step ───────────────────────────────────── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-6 flex-1 pt-12">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white mb-1">Password reset</h1>
            <p className="text-sm text-white/45">Sign in with your new password</p>
          </div>
          <Button fullWidth size="lg" onClick={() => router.push('/login')} className="mt-4">
            Sign in
          </Button>
        </div>
      )}
    </div>
  )
}
