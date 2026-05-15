'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { notify } from '@/lib/toast'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { generateDeviceKey } from '@/lib/crypto/deviceSigning'
import { requestDeviceRegistration, completeDeviceRegistration } from '@/lib/api/auth'

export default function AddDevicePage() {
  const { ensureDeviceId, setBooting } = useAuthStore()
  const [step, setStep]       = useState<'email' | 'otp' | 'done'>('email')
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { setBooting(false) }, [setBooting])

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await requestDeviceRegistration(email.trim())
      setStep('otp')
      notify.success('Check your email for a 6-digit code')
    } catch {
      notify.error('Could not send OTP. Check your email and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteRegistration(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const deviceId = ensureDeviceId()
      const { publicKey } = await generateDeviceKey(deviceId)
      await completeDeviceRegistration({ email: email.trim(), otp: otp.trim(), deviceId, publicKey })
      setStep('done')
      notify.success('Device registered!')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not register device')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-white/45">
          Your device is registered. You can now log in normally.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold hover:bg-[#c49a38] transition-colors"
        >
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">Register new device</h1>
        <p className="text-sm text-white/45 mt-1">
          {step === 'email'
            ? 'Enter your account email to receive a one-time code.'
            : `Enter the 6-digit code sent to ${email}.`}
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>Send code</Button>
          <Link
            href="/login"
            className="text-xs text-center text-white/40 hover:text-white/70 transition-colors"
          >
            Back to login
          </Link>
        </form>
      ) : (
        <form onSubmit={handleCompleteRegistration} className="flex flex-col gap-4">
          <Input
            label="6-digit code"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            required
            autoFocus
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>Register device</Button>
          <button
            type="button"
            className="text-xs text-center text-white/40 hover:text-white/70 transition-colors"
            onClick={() => setStep('email')}
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  )
}
