'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { notify } from '@/lib/toast'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/store/authStore'
import { login } from '@/lib/api/auth'
import { generateDeviceKey, hasDeviceKey, signDeviceChallenge } from '@/lib/crypto/deviceSigning'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth, ensureDeviceId, setBooting } = useAuthStore()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState<{ identifier?: string; password?: string }>({})

  // Auth boot: mark booting done (layout already checked user)
  useEffect(() => { setBooting(false) }, [setBooting])

  function validate() {
    const e: typeof errors = {}
    if (!identifier.trim()) e.identifier = 'Email or username is required'
    if (!password)          e.password   = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    try {
      const deviceId = ensureDeviceId()

      // Ensure a local device key exists for signing
      const exists = await hasDeviceKey(deviceId)
      if (!exists) {
        await generateDeviceKey(deviceId)
      }

      // Sign the raw deviceId string — backend verifies message === deviceId (UTF-8)
      const deviceSignature = await signDeviceChallenge(deviceId)

      const { user, tokens } = await login({
        identifier: identifier.trim(),
        password,
        deviceId,
        deviceSignature,
      })

      setAuth(user, tokens.accessToken)
      router.replace('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      // If the backend rejects the device signature the user needs to register
      // this device first via the add-device OTP flow
      const isDeviceError = /device|signature|unrecognized/i.test(msg)
      if (isDeviceError) {
        notify.error('This device is not recognised. Use "New device? Register it" below.')
      } else {
        notify.error(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Welcome back</h1>
        <p className="text-sm text-white/45">Sign in to your Cheese account</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email or username"
          type="text"
          autoComplete="username"
          placeholder="you@example.com or @username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={errors.identifier}
          autoCapitalize="none"
          spellCheck={false}
        />

        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          suffix={
            <button type="button" onClick={() => setShowPw(!showPw)} className="text-white/40 hover:text-white/70 transition-colors">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <div className="flex justify-between items-center">
          <Link
            href="/add-device"
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            New device? Register it
          </Link>
          <Link
            href="/forgot-password"
            className="text-xs text-[#d4a843]/80 hover:text-[#d4a843] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="text-sm text-white/40 text-center mt-8">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#d4a843] hover:underline">
          Create account
        </Link>
      </p>
    </div>
  )
}
