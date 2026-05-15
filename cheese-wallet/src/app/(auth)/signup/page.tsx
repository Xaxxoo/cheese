'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { notify } from '@/lib/toast'
import { Eye, EyeOff, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PinPad } from '@/components/ui/PinPad'
import { Spinner } from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { signup, verifyOtp, resendOtp, login } from '@/lib/api/auth'
import { generateDeviceKey, signPayload } from '@/lib/crypto/deviceSigning'
import { hashPin } from '@/lib/crypto/deviceSigning'

// ── Step indicator ─────────────────────────────────────────
function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1 flex-1 rounded-full transition-all duration-300"
          style={{ background: i < step ? '#d4a843' : 'rgba(255,255,255,0.1)' }}
        />
      ))}
    </div>
  )
}

// ── Username availability indicator ──────────────────────────
function UsernameStatus({ status }: { status: 'idle' | 'checking' | 'available' | 'taken' }) {
  if (status === 'idle')     return null
  if (status === 'checking') return <Spinner size="sm" className="text-white/40" />
  if (status === 'available') return <CheckCircle2 size={16} className="text-emerald-400" />
  return <XCircle size={16} className="text-red-400" />
}

// ── Password strength bar ───────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const colors = ['#ef4444','#f97316','#eab308','#22c55e']
  const labels = ['Weak','Fair','Good','Strong']

  if (!password) return null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <p className="text-xs" style={{ color: score > 0 ? colors[score - 1] : 'transparent' }}>
        {labels[score - 1]}
      </p>
    </div>
  )
}

// ── OTP input ───────────────────────────────────────────────
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.split('')

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="w-12 h-14 rounded-2xl border text-xl font-mono text-white flex items-center justify-center transition-all"
          style={{
            background: 'rgba(255,255,255,0.06)',
            borderColor: digits[i] ? '#d4a843' : 'rgba(255,255,255,0.1)',
          }}
        >
          {digits[i] ?? ''}
        </div>
      ))}
      {/* Hidden real input */}
      <input
        type="number"
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6)
          onChange(v)
        }}
        className="sr-only"
        autoFocus
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN SIGNUP PAGE
// ─────────────────────────────────────────────────────────────

type SignupStep = 1 | 2 | 3 | 4

interface SignupData {
  fullName: string
  email:    string
  phone:    string
  username: string
  password: string
}

export default function SignupPage() {
  const router = useRouter()
  const { setAuth, ensureDeviceId, setBooting } = useAuthStore()

  const [step, setStep]       = useState<SignupStep>(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm]       = useState<SignupData>({
    fullName: '', email: '', phone: '', username: '', password: '',
  })
  const [showPw, setShowPw]           = useState(false)
  const [otp, setOtp]                 = useState('')
  const [pin, setPin]                 = useState('')
  const [confirmPin, setConfirmPin]   = useState('')
  const [pinStep, setPinStep]         = useState<'set' | 'confirm'>('set')
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle')
  const [errors, setErrors]           = useState<Partial<SignupData & { otp: string }>>({})

  useEffect(() => { setBooting(false) }, [setBooting])

  // ── Username debounce check ──────────────────────────────
  const checkUsername = useCallback(async (name: string) => {
    if (name.length < 3) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    try {
      // Import inline to avoid bundle on server
      const { default: apiClient } = await import('@/lib/api/client')
      await apiClient.get(`/waitlist/check-username?username=${name}`)
      setUsernameStatus('available')
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      setUsernameStatus(status === 409 ? 'taken' : 'available')
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.username) checkUsername(form.username)
    }, 500)
    return () => clearTimeout(t)
  }, [form.username, checkUsername])

  function set(field: keyof SignupData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // ── Step 1 validation ────────────────────────────────────
  function validateStep1() {
    const e: typeof errors = {}
    if (!form.fullName.trim())         e.fullName = 'Full name is required'
    if (!form.email.trim())            e.email    = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required'
    } else {
      const normalized = form.phone.trim().replace(/[\s\-()]/g, '')
      if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
        e.phone = 'Must start with country code, e.g. +2348012345678'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Step 2 validation ────────────────────────────────────
  function validateStep2() {
    const e: typeof errors = {}
    if (!form.username.trim())         e.username = 'Username is required'
    else if (form.username.length < 3) e.username = 'At least 3 characters'
    else if (usernameStatus === 'taken') e.username = 'Username is already taken'
    if (!form.password)                e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'At least 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit step 1→2 ──────────────────────────────────────
  async function submitStep1() {
    if (!validateStep1()) return
    setStep(2)
  }

  // ── Submit step 2: call signup API ───────────────────────
  async function submitStep2() {
    if (!validateStep2()) return
    setLoading(true)
    try {
      const deviceId = ensureDeviceId()
      const { publicKey } = await generateDeviceKey(deviceId)

      await signup({
        fullName:       form.fullName.trim(),
        email:          form.email.trim().toLowerCase(),
        phone:          form.phone.trim().replace(/[\s\-()]/g, ''),
        username:       form.username.trim().toLowerCase(),
        password:       form.password,
        devicePublicKey: publicKey,
        deviceId,
      })

      setStep(3)
    } catch (err) {
      // A timeout means the backend was slow to respond (usually while sending the
      // verification email) but the account was created and the email was sent.
      // Advance to the OTP screen instead of surfacing an error.
      const isTimeout = err instanceof Error && err.message.toLowerCase().includes('timeout')
      if (isTimeout) {
        setStep(3)
      } else {
        notify.error(err instanceof Error ? err.message : 'Signup failed. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Submit OTP ───────────────────────────────────────────
  async function submitOtp() {
    if (otp.length < 6) {
      setErrors(prev => ({ ...prev, otp: 'Enter the 6-digit code' }))
      return
    }
    setLoading(true)
    try {
      await verifyOtp({ email: form.email.toLowerCase(), otp, type: 'email_verify' })

      // Auto-login after OTP verification
      const deviceId = ensureDeviceId()
      const deviceSignature = await signPayload(deviceId, { deviceId })
      const { user, tokens } = await login({
        identifier:      form.email.toLowerCase(),
        password:        form.password,
        deviceId,
        deviceSignature,
      })
      setAuth(user, tokens.accessToken)

      setStep(4) // PIN setup
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Invalid code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    try {
      await resendOtp(form.email.toLowerCase(), 'email_verify')
      notify.success('Code resent — check your inbox')
    } catch {
      notify.error('Could not resend code')
    }
  }

  // ── Submit PIN ───────────────────────────────────────────
  async function submitPin() {
    if (pinStep === 'set') {
      if (pin.length < 6) { notify.error('Enter a 6-digit PIN'); return }
      setPinStep('confirm')
      return
    }
    // Confirm step
    if (confirmPin !== pin) {
      notify.error('PINs don\'t match — try again')
      setConfirmPin('')
      return
    }
    setLoading(true)
    try {
      const deviceId = ensureDeviceId()
      const pinHash = await hashPin(pin, deviceId)

      const { default: apiClient } = await import('@/lib/api/client')
      await apiClient.post('/auth/set-pin', { pinHash })

      notify.success('PIN set successfully')
      router.replace('/dashboard')
    } catch {
      // PIN setting is non-fatal — proceed to dashboard anyway
      // They can set it later in profile
      router.replace('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1">
      <StepBar step={step} total={4} />

      {/* ── Step 1: Personal info ────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Create your account</h1>
            <p className="text-sm text-white/45">You&apos;ll use this to sign in</p>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label="Full name"
              placeholder="Ada Okonkwo"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              error={errors.fullName}
              autoComplete="name"
            />
            <Input
              label="Email address"
              type="email"
              placeholder="ada@example.com"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              autoComplete="email"
              autoCapitalize="none"
            />
            <Input
              label="Phone number"
              type="tel"
              placeholder="+234 801 234 5678"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={errors.phone}
              autoComplete="tel"
              hint="Include your country code, e.g. +234 for Nigeria"
            />
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <Button fullWidth size="lg" onClick={submitStep1}>
              Continue
            </Button>
            <p className="text-sm text-white/40 text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-[#d4a843] hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2: Username + password ──────────────────── */}
      {step === 2 && (
        <div className="flex flex-col gap-6 flex-1">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setStep(1)} className="text-white/40 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-white mb-0.5">Choose your username</h1>
              <p className="text-sm text-white/45">This is how others find and pay you</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label="Username"
              placeholder="ada_finance"
              value={form.username}
              onChange={(e) => set('username', e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
              error={errors.username}
              prefix="@"
              suffix={<UsernameStatus status={usernameStatus} />}
              autoCapitalize="none"
              spellCheck={false}
            />

            <div className="flex flex-col gap-2">
              <Input
                label="Password"
                type={showPw ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                error={errors.password}
                autoComplete="new-password"
                suffix={
                  <button type="button" onClick={() => setShowPw(!showPw)} className="text-white/40 hover:text-white/70 transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
              <PasswordStrength password={form.password} />
            </div>
          </div>

          <div className="mt-auto">
            <Button fullWidth size="lg" onClick={submitStep2} loading={loading}>
              Create account
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: OTP verification ─────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">Check your email</h1>
            <p className="text-sm text-white/45">
              We sent a 6-digit code to{' '}
              <span className="text-white/70">{form.email}</span>
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <OtpInput value={otp} onChange={setOtp} />
            {errors.otp && (
              <p className="text-xs text-red-400 text-center">{errors.otp}</p>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <Button fullWidth size="lg" onClick={submitOtp} loading={loading} disabled={otp.length < 6}>
              Verify email
            </Button>
            <button
              type="button"
              onClick={resendCode}
              className="text-sm text-white/40 hover:text-white/70 transition-colors text-center"
            >
              Didn&apos;t get it? Resend code
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: PIN setup ─────────────────────────────── */}
      {step === 4 && (
        <div className="flex flex-col gap-6 flex-1">
          <div>
            <h1 className="text-2xl font-semibold text-white mb-1">
              {pinStep === 'set' ? 'Set your PIN' : 'Confirm your PIN'}
            </h1>
            <p className="text-sm text-white/45">
              {pinStep === 'set'
                ? 'You\'ll use this to authorise transfers'
                : 'Enter your PIN again to confirm'}
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <PinPad
              value={pinStep === 'set' ? pin : confirmPin}
              onChange={pinStep === 'set' ? setPin : setConfirmPin}
              maxLength={6}
            />
          </div>

          <div className="flex flex-col gap-3">
            {pinStep === 'set' && (
              <Button fullWidth size="lg" onClick={submitPin} disabled={pin.length < 6} loading={loading}>
                Set PIN
              </Button>
            )}
            {pinStep === 'confirm' && (
              <>
                <Button fullWidth size="lg" onClick={submitPin} disabled={confirmPin.length < 6} loading={loading}>
                  Confirm PIN
                </Button>
                <button
                  type="button"
                  onClick={() => { setConfirmPin(''); setPinStep('set') }}
                  className="text-sm text-white/40 hover:text-white/70 transition-colors text-center"
                >
                  Change PIN
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => router.replace('/dashboard')}
              className="text-sm text-white/30 hover:text-white/50 transition-colors text-center"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
