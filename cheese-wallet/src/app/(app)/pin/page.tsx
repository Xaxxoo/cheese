'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { setPin as apiSetPin, changePin as apiChangePin } from '@/lib/api/auth'
import { hashPin, signDeviceChallenge } from '@/lib/crypto/deviceSigning'
import { PinPad } from '@/components/ui/PinPad'

type SetPhase    = 'enter' | 'confirm'
type ChangePhase = 'current' | 'new' | 'confirm'

export default function PinPage() {
  const router = useRouter()
  const { user, deviceId, updateUser } = useAuthStore()
  const isChange = user?.hasPin === true

  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  // ── Set-PIN state ──────────────────────────────────────
  const [setPhase, setSetPhase]   = useState<SetPhase>('enter')
  const [firstPin, setFirstPin]   = useState('')

  // ── Change-PIN state ───────────────────────────────────
  const [changePhase, setChangePhase] = useState<ChangePhase>('current')
  const [currentPin, setCurrentPin]   = useState('')
  const [newPin, setNewPin]           = useState('')

  // ── Submit: Set PIN ────────────────────────────────────
  const submitSetPin = useCallback(async (confirmed: string) => {
    if (!user) return
    if (confirmed !== firstPin) {
      setError("PINs don't match — try again")
      setPin('')
      setFirstPin('')
      setSetPhase('enter')
      return
    }
    setLoading(true)
    setError('')
    try {
      const pinHash = await hashPin(confirmed, user.id)
      await apiSetPin(pinHash)
      updateUser({ hasPin: true })
      setDone(true)
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to set PIN')
      // Stale auth store: PIN was already set. Refresh state and switch to change flow.
      if (msg.toLowerCase().includes('already set')) {
        updateUser({ hasPin: true })
      } else {
        setError(msg)
      }
      setPin('')
      setFirstPin('')
      setSetPhase('enter')
    } finally {
      setLoading(false)
    }
  }, [user, firstPin, updateUser])

  // ── Submit: Change PIN ─────────────────────────────────
  const submitChangePin = useCallback(async (confirmed: string) => {
    if (!user) return
    if (confirmed !== newPin) {
      setError("New PINs don't match — try again")
      setPin('')
      setNewPin('')
      setChangePhase('new')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [currentPinHash, newPinHash, deviceSignature] = await Promise.all([
        hashPin(currentPin, user.id),
        hashPin(confirmed, user.id),
        signDeviceChallenge(deviceId),
      ])
      await apiChangePin({ currentPinHash, newPinHash, deviceId, deviceSignature })
      setDone(true)
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err instanceof Error ? err.message : 'Failed to change PIN')
      const isWrongPin = msg.toLowerCase().includes('incorrect')
      setError(isWrongPin ? 'Incorrect current PIN — try again' : msg)
      setPin('')
      setCurrentPin('')
      setNewPin('')
      setChangePhase('current')
    } finally {
      setLoading(false)
    }
  }, [user, currentPin, newPin, deviceId])

  // ── Auto-advance / auto-submit effects ─────────────────

  // Set PIN — step 1: store first entry, advance to confirm
  useEffect(() => {
    if (!isChange && setPhase === 'enter' && pin.length === 6) {
      setFirstPin(pin)
      setPin('')
      setSetPhase('confirm')
      setError('')
    }
  }, [pin, setPhase, isChange])

  // Set PIN — step 2: confirm entered, submit
  useEffect(() => {
    if (!isChange && setPhase === 'confirm' && pin.length === 6 && !loading) {
      void submitSetPin(pin)
    }
  }, [pin, setPhase, isChange, loading, submitSetPin])

  // Change PIN — step 1: store current PIN, advance
  useEffect(() => {
    if (isChange && changePhase === 'current' && pin.length === 6) {
      setCurrentPin(pin)
      setPin('')
      setChangePhase('new')
      setError('')
    }
  }, [pin, changePhase, isChange])

  // Change PIN — step 2: store new PIN, advance to confirm
  useEffect(() => {
    if (isChange && changePhase === 'new' && pin.length === 6) {
      setNewPin(pin)
      setPin('')
      setChangePhase('confirm')
      setError('')
    }
  }, [pin, changePhase, isChange])

  // Change PIN — step 3: confirm entered, submit
  useEffect(() => {
    if (isChange && changePhase === 'confirm' && pin.length === 6 && !loading) {
      void submitChangePin(pin)
    }
  }, [pin, changePhase, isChange, loading, submitChangePin])

  // ── Label for PinPad ───────────────────────────────────
  const label = !isChange
    ? (setPhase === 'enter' ? 'Create a 6-digit PIN' : 'Confirm your PIN')
    : (changePhase === 'current' ? 'Enter your current PIN'
      : changePhase === 'new'     ? 'Enter your new PIN'
      :                             'Confirm your new PIN')

  // ── Success screen ─────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[72vh] px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-400/15 flex items-center justify-center mb-5">
          <ShieldCheck size={38} className="text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          {isChange ? 'PIN Updated' : 'PIN Set'}
        </h2>
        <p className="text-sm text-white/40 mb-8">
          {isChange
            ? 'Your transaction PIN has been updated.'
            : 'Your account is now protected with a PIN.'}
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
      <div className="flex items-center gap-3 px-4 pt-5 pb-6">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">
          {isChange ? 'Change PIN' : 'Set PIN'}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center mt-20">
          <div className="w-8 h-8 border-2 border-[#d4a843]/40 border-t-[#d4a843] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 mt-4">
          <PinPad
            value={pin}
            onChange={setPin}
            maxLength={6}
            label={label}
            error={error}
          />
        </div>
      )}
    </div>
  )
}
