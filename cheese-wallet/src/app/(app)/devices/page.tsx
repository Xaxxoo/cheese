'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Smartphone, Trash2, RefreshCw, Shield, ShieldCheck, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { listDevices, revokeDevice } from '@/lib/api/wallet'
import { QUERY_KEYS, STALE_TIMES } from '@/constants'
import { notify } from '@/lib/toast'

// ── Skeleton ────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-white/8 rounded-xl animate-pulse', className)} />
}

// ── Helpers ─────────────────────────────────────────────────
function formatLastSeen(iso: string) {
  const d    = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000)    return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Confirm modal ────────────────────────────────────────────
function ConfirmModal({
  deviceName,
  onConfirm,
  onCancel,
  loading,
}: {
  deviceName: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-white/8 px-5 py-6"
        style={{ background: 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)' }}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">Remove device?</p>
            <p className="text-sm text-white/40 mt-1">
              <span className="text-white/60 font-medium">{deviceName}</span> will be signed out and
              will need to re-register to access your account.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 rounded-2xl border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-red-500/15 border border-red-500/25 text-sm text-red-400 font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
              {loading ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Device row ───────────────────────────────────────────────
function DeviceRow({
  device,
  onRevoke,
  revoking,
}: {
  device: { id: string; deviceName: string; lastSeen: string; location?: string; isCurrent: boolean }
  onRevoke: (id: string, name: string) => void
  revoking: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl px-4 py-4 border transition-colors',
        device.isCurrent
          ? 'border-emerald-400/20 bg-emerald-400/5'
          : 'border-white/6 bg-white/3',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          device.isCurrent ? 'bg-emerald-400/15' : 'bg-white/8',
        )}
      >
        <Smartphone
          size={18}
          className={device.isCurrent ? 'text-emerald-400' : 'text-white/40'}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white truncate">{device.deviceName}</p>
          {device.isCurrent && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400 font-semibold shrink-0">
              This device
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/35 mt-0.5">
          {device.location ? `${device.location} · ` : ''}
          Last active {formatLastSeen(device.lastSeen)}
        </p>
      </div>

      {/* Revoke */}
      {!device.isCurrent && (
        <button
          type="button"
          onClick={() => onRevoke(device.id, device.deviceName)}
          disabled={revoking}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-40 shrink-0"
          aria-label="Remove device"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function DevicesPage() {
  const { deviceId: currentDeviceId } = useAuthStore()
  const qc = useQueryClient()

  const [confirmTarget, setConfirmTarget] = useState<{ id: string; name: string } | null>(null)

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
      setConfirmTarget(null)
      notify.success('Device removed')
    },
    onError: () => {
      setConfirmTarget(null)
      notify.error('Could not remove device')
    },
  })

  const devices = devQ.data ?? []
  const currentDevice = devices.find(d => d.id === currentDeviceId || d.isCurrent)
  const otherDevices  = devices.filter(d => d.id !== currentDevice?.id)

  return (
    <div className="flex flex-col pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <Link
          href="/profile"
          className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white flex-1">Trusted Devices</h1>
        {devQ.isFetching && !devQ.isLoading && (
          <RefreshCw size={14} className="text-white/30 animate-spin" />
        )}
      </div>

      {/* Security banner */}
      <div className="mx-4 mb-5 rounded-2xl border border-[#d4a843]/15 bg-[#d4a843]/5 px-4 py-3 flex items-start gap-3">
        <Shield size={16} className="text-[#d4a843] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-[#d4a843]">Manage your sessions</p>
          <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">
            These devices have access to your Cheese Pay account. Remove any device you don't recognise immediately.
          </p>
        </div>
      </div>

      {/* Loading */}
      {devQ.isLoading && (
        <div className="mx-4 flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {devQ.isError && (
        <div className="mx-4 rounded-2xl border border-red-400/10 bg-red-400/5 px-4 py-5 flex flex-col items-center gap-3">
          <AlertTriangle size={20} className="text-red-400/60" />
          <p className="text-sm text-white/40">Could not load devices</p>
          <button
            type="button"
            onClick={() => devQ.refetch()}
            className="flex items-center gap-1.5 text-xs text-[#d4a843]/70 hover:text-[#d4a843] transition-colors"
          >
            <RefreshCw size={11} />
            Try again
          </button>
        </div>
      )}

      {/* Device list */}
      {devQ.data && (
        <>
          {/* Current device */}
          {currentDevice && (
            <div className="mx-4 mb-4">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2 px-1">
                Current device
              </p>
              <DeviceRow
                device={currentDevice}
                onRevoke={(id, name) => setConfirmTarget({ id, name })}
                revoking={revokeMut.isPending && revokeMut.variables === currentDevice.id}
              />
            </div>
          )}

          {/* Other devices */}
          {otherDevices.length > 0 && (
            <div className="mx-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                  Other devices
                </p>
                <span className="text-[10px] text-white/20">{otherDevices.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {otherDevices.map(device => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    onRevoke={(id, name) => setConfirmTarget({ id, name })}
                    revoking={revokeMut.isPending && revokeMut.variables === device.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Only current device */}
          {otherDevices.length === 0 && (
            <div className="mx-4 mt-2 rounded-2xl border border-white/6 bg-white/2 px-4 py-5 flex flex-col items-center gap-2">
              <ShieldCheck size={22} className="text-emerald-400/60" />
              <p className="text-sm text-white/50 text-center">Only this device has access</p>
              <p className="text-[11px] text-white/25 text-center">
                No other sessions are active on your account.
              </p>
            </div>
          )}
        </>
      )}

      {/* Confirm revoke modal */}
      {confirmTarget && (
        <ConfirmModal
          deviceName={confirmTarget.name}
          onConfirm={() => revokeMut.mutate(confirmTarget.id)}
          onCancel={() => setConfirmTarget(null)}
          loading={revokeMut.isPending}
        />
      )}
    </div>
  )
}
