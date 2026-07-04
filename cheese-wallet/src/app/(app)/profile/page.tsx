'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, LogOut, Copy, CheckCheck,
  Smartphone, RefreshCw, Trash2, User, Gift,
  BadgeCheck, AlertCircle, Clock, ChevronRight, KeyRound, MailWarning, Pencil, FileText,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { getReferralInfo, listDevices, revokeDevice } from '@/lib/api/wallet'
import { resendOtp } from '@/lib/api/auth'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import { notify } from '@/lib/toast'

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Tier badge ─────────────────────────────────────────────
const TIER_CFG = {
  silver: { label: 'Silver', bg: 'bg-gray-400/15', text: 'text-gray-300' },
  gold:   { label: 'Gold',   bg: 'bg-[#d4a843]/15', text: 'text-[#d4a843]' },
  black:  { label: 'Black',  bg: 'bg-white/10',     text: 'text-white' },
}

// ── KYC badge ──────────────────────────────────────────────
const KYC_CFG = {
  pending:   { icon: Clock,        label: 'Pending',    bg: 'bg-amber-400/15',   text: 'text-amber-400' },
  submitted: { icon: Clock,        label: 'Submitted',  bg: 'bg-amber-400/15',   text: 'text-amber-400' },
  verified:  { icon: BadgeCheck,   label: 'Verified',   bg: 'bg-emerald-400/15', text: 'text-emerald-400' },
  rejected:  { icon: AlertCircle,  label: 'Rejected',   bg: 'bg-red-400/15',     text: 'text-red-400' },
}

// ── Row helper ─────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs text-white font-medium">{value}</span>
    </div>
  )
}

// ── Referral section ───────────────────────────────────────
function ReferralCard() {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const refQ = useQuery({
    queryKey: QUERY_KEYS.REFERRAL,
    queryFn:  getReferralInfo,
    staleTime: STALE_TIMES.PROFILE,
    retry: 1,
  })

  async function copyCode() {
    const code = refQ.data?.code
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      notify.error('Could not copy code')
    }
  }

  async function copyLink() {
    const link = refQ.data?.link
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch {
      notify.error('Could not copy link')
    }
  }

  return (
    <div className="mx-4 mt-2 rounded-2xl border border-white/8" style={{ background: 'rgba(212,168,67,0.04)' }}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Gift size={15} className="text-[#d4a843]" />
        <span className="text-sm font-semibold text-white">Referrals</span>
      </div>

      {refQ.isLoading && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <Skeleton className="h-8 rounded-xl" />
          <Skeleton className="h-8 rounded-xl" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      )}

      {refQ.isError && (
        <div className="px-4 pb-4 flex items-center gap-2">
          <p className="text-xs text-white/30">Could not load referral info</p>
          <button
            type="button"
            onClick={() => refQ.refetch()}
            className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {refQ.data && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Code copy */}
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center justify-between w-full bg-white/6 rounded-xl px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <div>
              <p className="text-[10px] text-white/30 mb-0.5">Your referral code</p>
              <p className="text-base font-semibold text-[#d4a843] tracking-widest">{refQ.data.code}</p>
            </div>
            {copiedCode
              ? <CheckCheck size={16} className="text-emerald-400" />
              : <Copy size={14} className="text-white/30" />
            }
          </button>

          {/* Link copy */}
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center justify-between w-full bg-white/6 rounded-xl px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] text-white/30 mb-0.5">Your referral link</p>
              <p className="text-xs text-white/70 truncate">{refQ.data.link}</p>
            </div>
            <div className="shrink-0 ml-3">
              {copiedLink
                ? <CheckCheck size={16} className="text-emerald-400" />
                : <Copy size={14} className="text-white/30" />
              }
            </div>
          </button>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Referred', value: (refQ.data.totalReferrals ?? 0).toString() },
              { label: 'Pending', value: `$${(refQ.data.pendingReward ?? 0).toFixed(2)}` },
              { label: 'Earned',  value: `$${(refQ.data.paidReward ?? 0).toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-2.5 text-center">
                <p className="text-sm font-semibold text-white">{value}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Link to full referral page */}
          <Link
            href="/referral"
            className="flex items-center justify-between px-1 pt-1 text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
          >
            <span>View full referral page</span>
            <ChevronRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Devices section ────────────────────────────────────────
function DevicesCard({ currentDeviceId }: { currentDeviceId: string }) {
  const qc = useQueryClient()

  const devQ = useQuery({
    queryKey: QUERY_KEYS.DEVICES,
    queryFn:  listDevices,
    staleTime: STALE_TIMES.PROFILE,
    retry: 1,
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeDevice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.DEVICES })
      notify.success('Device removed')
    },
    onError: () => notify.error('Could not remove device'),
  })

  function formatLastSeen(iso: string) {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000)   return 'Just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="mx-4 mt-2 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Smartphone size={15} className="text-white/50" />
          <span className="text-sm font-semibold text-white">Trusted Devices</span>
        </div>
        <Link href="/devices" className="text-[10px] text-[#d4a843]/60 hover:text-[#d4a843] transition-colors flex items-center gap-0.5">
          Manage <ChevronRight size={11} />
        </Link>
      </div>

      {devQ.isLoading && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      )}

      {devQ.isError && (
        <div className="px-4 pb-4 flex items-center gap-2">
          <p className="text-xs text-white/30">Could not load devices</p>
          <button
            type="button"
            onClick={() => devQ.refetch()}
            className="text-xs text-[#d4a843]/70 hover:text-[#d4a843] flex items-center gap-1 transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )}

      {devQ.data && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {devQ.data.map(device => (
            <div
              key={device.id}
              className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-3"
            >
              <div className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                <Smartphone size={14} className="text-white/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {device.deviceName}
                  {device.isCurrent && (
                    <span className="ml-1.5 text-[10px] text-emerald-400/80">(this device)</span>
                  )}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {device.location ? `${device.location} · ` : ''}
                  {formatLastSeen(device.lastSeen)}
                </p>
              </div>
              {!device.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeMut.mutate(device.id)}
                  disabled={revokeMut.isPending}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────
export default function ProfilePage() {
  const router  = useRouter()
  const { user, signOut, deviceId } = useAuthStore()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const [resendingEmail, setResendingEmail]       = useState(false)
  const [emailResent, setEmailResent]             = useState(false)

  async function handleResendVerification() {
    if (!user?.email || resendingEmail || emailResent) return
    setResendingEmail(true)
    try {
      await resendOtp(user.email, 'email_verify')
      setEmailResent(true)
    } catch {
      notify.error('Could not resend verification email')
    } finally {
      setResendingEmail(false)
    }
  }

  function handleSignOut() {
    signOut()
    router.replace('/login')
  }

  const tier   = user?.tier ?? 'silver'
  const kyc    = user?.kycStatus ?? 'pending'
  const tCfg   = TIER_CFG[tier]
  const kCfg   = KYC_CFG[kyc]
  const KycIcon = kCfg.icon

  return (
    <div className="flex flex-col pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/dashboard"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white flex-1">Profile</h1>
        <Link
          href="/profile/edit"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <Pencil size={15} />
        </Link>
      </div>

      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 pt-2 pb-6">
        <div className="w-20 h-20 rounded-full bg-[#d4a843]/15 border-2 border-[#d4a843]/30 flex items-center justify-center">
          <User size={34} className="text-[#d4a843]/70" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{user?.fullName ?? '—'}</p>
          <p className="text-sm text-white/40 mt-0.5">@{user?.username ?? '—'}</p>
        </div>

        {/* Tier + KYC badges */}
        <div className="flex items-center gap-2">
          <span className={cn('text-xs px-3 py-1 rounded-full font-medium', tCfg.bg, tCfg.text)}>
            {tCfg.label}
          </span>
          <span className={cn('flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium', kCfg.bg, kCfg.text)}>
            <KycIcon size={11} />
            KYC {kCfg.label}
          </span>
        </div>
      </div>

      {/* Account info */}
      <div className="mx-4 rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <InfoRow label="Email"    value={user?.email ?? '—'} />
        <InfoRow label="Phone"    value={user?.phone ?? '—'} />
        <InfoRow label="Username" value={`@${user?.username ?? '—'}`} />
        <InfoRow label="Member since" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : '—'} />
      </div>


      {/* Email not verified */}
      {user?.emailVerified === false && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3.5">
          <MailWarning size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Email not verified</p>
            <p className="text-xs text-white/40 mt-0.5">
              {emailResent ? 'Verification email sent — check your inbox' : 'Check your inbox or resend the verification email'}
            </p>
          </div>
          {!emailResent && (
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="shrink-0 text-[11px] font-medium text-[#d4a843] hover:text-[#d4a843]/80 disabled:opacity-40 transition-opacity"
            >
              {resendingEmail ? 'Sending…' : 'Resend'}
            </button>
          )}
        </div>
      )}

      {/* PIN setup banner */}
      {!user?.hasPin && (
        <Link
          href="/pin"
          className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3.5 hover:bg-amber-400/8 transition-colors"
        >
          <KeyRound size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Set up your PIN</p>
            <p className="text-xs text-white/40 mt-0.5">Required to send money and make transfers</p>
          </div>
          <ChevronRight size={14} className="text-amber-400/60 shrink-0" />
        </Link>
      )}

      {/* KYC action */}
      {kyc === 'pending' && (
        <Link
          href="/kyc"
          className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3.5 hover:bg-amber-400/8 transition-colors"
        >
          <Clock size={16} className="text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-400">Verify your identity</p>
            <p className="text-xs text-white/40 mt-0.5">Required to send money and make transfers</p>
          </div>
          <ChevronRight size={14} className="text-amber-400/60 shrink-0" />
        </Link>
      )}

      {kyc === 'submitted' && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/5 px-4 py-3.5">
          <Clock size={16} className="text-sky-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sky-400">Verification under review</p>
            <p className="text-xs text-white/40 mt-0.5">We're reviewing your submission — nothing to do</p>
          </div>
        </div>
      )}

      {kyc === 'rejected' && (
        <Link
          href="/kyc"
          className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3.5 hover:bg-red-400/8 transition-colors"
        >
          <AlertCircle size={16} className="text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-red-400">Verification failed — try again</p>
            <p className="text-xs text-white/40 mt-0.5">Tap to retry with a different ID type</p>
          </div>
          <ChevronRight size={14} className="text-red-400/60 shrink-0" />
        </Link>
      )}

      {/* Wallet failure warning */}
      {(user?.stellarWalletStatus === 'failed' || user?.evmWalletStatus === 'failed') && (
        <div className="mx-4 mt-3 rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3.5 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-red-400">Wallet setup incomplete</p>
            <p className="text-xs text-white/40 mt-0.5">
              Your wallet could not be created automatically. Please{' '}
              <a href="mailto:support@cheesepay.xyz" className="text-[#d4a843] hover:underline">
                contact support
              </a>{' '}
              to resolve this.
            </p>
          </div>
        </div>
      )}

      {/* Account links */}
      <div className="mx-4 mt-2 rounded-2xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <Link
          href="/statements"
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors border-b border-white/5"
        >
          <FileText size={14} className="text-white/40 shrink-0" />
          <span className="text-xs text-white flex-1">Bank Statements</span>
          <ChevronRight size={14} className="text-white/25 shrink-0" />
        </Link>
        {user?.hasPin && (
          <Link
            href="/pin"
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
          >
            <KeyRound size={14} className="text-white/40 shrink-0" />
            <span className="text-xs text-white flex-1">Change PIN</span>
            <ChevronRight size={14} className="text-white/25 shrink-0" />
          </Link>
        )}
      </div>

      {/* Referral */}
      <ReferralCard />

      {/* Devices */}
      <DevicesCard currentDeviceId={deviceId} />

      {/* Sign out */}
      <div className="mx-4 mt-5">
        {confirmingSignOut ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-4">
            <p className="text-xs text-white/60 text-center mb-3">Sign out of your account?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingSignOut(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 py-2.5 rounded-xl bg-red-400/15 border border-red-400/20 text-red-400 text-sm font-medium hover:bg-red-400/25 transition-all"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingSignOut(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-400/20 text-red-400 text-sm font-medium hover:bg-red-400/10 transition-all"
          >
            <LogOut size={15} />
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}
