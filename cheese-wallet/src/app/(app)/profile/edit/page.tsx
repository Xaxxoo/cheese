'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/wallet'
import { notify } from '@/lib/toast'
import { PhoneInput } from '@/components/ui/PhoneInput'

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#d4a843]/50 transition-colors'

export default function EditProfilePage() {
  const router = useRouter()
  const { user, updateUser } = useAuthStore()

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [phone, setPhone]       = useState(user?.phone ?? '')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: { fullName?: string; username?: string; phone?: string } = {}
    const trimmedName     = fullName.trim()
    const trimmedUsername = username.trim()
    const trimmedPhone    = phone.trim()

    if (trimmedName     !== (user?.fullName ?? '')) payload.fullName = trimmedName
    if (trimmedUsername !== (user?.username ?? '')) payload.username = trimmedUsername
    if (trimmedPhone    !== (user?.phone    ?? '')) payload.phone    = trimmedPhone

    if (Object.keys(payload).length === 0) {
      router.back()
      return
    }

    setLoading(true)
    try {
      const updated = await updateProfile(payload)
      updateUser(updated)
      notify.success('Profile updated')
      router.replace('/profile')
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update profile'
      notify.error(msg)
    } finally {
      setLoading(false)
    }
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
        <h1 className="text-base font-semibold text-white">Edit Profile</h1>
      </div>

      <form onSubmit={handleSubmit} className="mx-4 flex flex-col gap-4">
        <Field label="Full Name">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className={inputClass}
          />
        </Field>

        <Field label="Username">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())
              }
              placeholder="username"
              className={`${inputClass} pl-8`}
            />
          </div>
        </Field>

        <PhoneInput
          label="Phone"
          value={phone}
          onChange={setPhone}
        />

        <Field label="Email" hint="Email cannot be changed">
          <input
            type="email"
            value={user?.email ?? ''}
            readOnly
            className={`${inputClass} opacity-40 cursor-not-allowed`}
          />
        </Field>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-[#d4a843] text-black text-sm font-semibold disabled:opacity-40 transition-opacity mt-2"
        >
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
