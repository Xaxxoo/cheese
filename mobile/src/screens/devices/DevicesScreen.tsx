import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Modal,
} from 'react-native'
import { ArrowLeft, Smartphone, Trash2, Shield, AlertTriangle, CheckCircle } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { listDevices, revokeDevice } from '../../api/wallet'
import type { DeviceSummary } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Devices'>
type ConfirmTarget = { id: string; name: string } | null

// ── Helpers ───────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)     return 'Just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Confirm modal ─────────────────────────────────────────

function ConfirmModal({
  target,
  revoking,
  onConfirm,
  onCancel,
}: {
  target: ConfirmTarget
  revoking: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.iconWrap}>
            <AlertTriangle size={22} color="#f87171" strokeWidth={1.5} />
          </View>
          <Text style={m.title}>Remove device?</Text>
          <Text style={m.body}>
            <Text style={m.deviceName}>{target?.name ?? ''}</Text>
            {' '}will be signed out and will need to re-register to access your account.
          </Text>
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onCancel} disabled={revoking}>
              <Text style={m.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={m.removeBtn} onPress={onConfirm} disabled={revoking}>
              {revoking
                ? <ActivityIndicator color="#f87171" size="small" />
                : <Text style={m.removeText}>Remove</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const m = StyleSheet.create({
  overlay:    {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet:      {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40,
    alignItems: 'center', gap: 12,
  },
  iconWrap:   {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title:      { fontSize: 16, fontWeight: '600', color: '#fff' },
  body:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
  deviceName: { color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  btnRow:     { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  cancelBtn:  {
    flex: 1, height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  removeBtn:  {
    flex: 1, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(248,113,113,0.15)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  removeText: { fontSize: 14, color: '#f87171', fontWeight: '700' },
})

// ── Device row ────────────────────────────────────────────

function DeviceRow({
  device,
  onRevoke,
  revoking,
}: {
  device: DeviceSummary
  onRevoke: () => void
  revoking: boolean
}) {
  return (
    <View style={[r.row, device.isCurrent && r.rowCurrent]}>
      <View style={[r.iconWrap, device.isCurrent && r.iconWrapCurrent]}>
        <Smartphone size={20} color={device.isCurrent ? '#4ade80' : 'rgba(255,255,255,0.5)'} strokeWidth={1.5} />
      </View>

      <View style={r.meta}>
        <View style={r.nameRow}>
          <Text style={r.name} numberOfLines={1}>{device.deviceName}</Text>
          {device.isCurrent && (
            <View style={r.badge}>
              <Text style={r.badgeText}>This device</Text>
            </View>
          )}
        </View>
        <Text style={r.sub}>
          {device.location ? `${device.location} · ` : ''}
          Last active {formatLastSeen(device.lastSeen)}
        </Text>
      </View>

      {!device.isCurrent && (
        <TouchableOpacity
          style={r.trashBtn}
          onPress={onRevoke}
          disabled={revoking}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {revoking
            ? <ActivityIndicator color="#f87171" size="small" />
            : <Trash2 size={18} color="#f87171" strokeWidth={1.5} />
          }
        </TouchableOpacity>
      )}
    </View>
  )
}

const r = StyleSheet.create({
  row:             {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  rowCurrent:      {
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  iconWrap:        {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapCurrent: { backgroundColor: 'rgba(34,197,94,0.15)' },
  meta:            { flex: 1 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:            { fontSize: 14, fontWeight: '500', color: '#fff' },
  badge:           {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  badgeText:       { fontSize: 10, fontWeight: '600', color: '#4ade80' },
  sub:             { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  trashBtn:        {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
})

// ── Screen ────────────────────────────────────────────────

export default function DevicesScreen({ navigation }: Props) {
  const [devices,       setDevices]       = useState<DeviceSummary[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null)
  const [revokingId,    setRevokingId]    = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const result = await listDevices()
      setDevices(result)
      setError(null)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to load devices'
      setError(msg)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load])

  async function handleRevoke() {
    if (!confirmTarget) return
    setRevokingId(confirmTarget.id)
    try {
      await revokeDevice(confirmTarget.id)
      setConfirmTarget(null)
      await load()
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Could not remove device'
      setError(msg)
      setConfirmTarget(null)
    } finally {
      setRevokingId(null)
    }
  }

  const currentDevice = devices.find((d) => d.isCurrent) ?? null
  const otherDevices  = devices.filter((d) => !d.isCurrent)

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={s.title}>Trusted Devices</Text>
        </View>

        {/* Security banner */}
        <View style={s.securityBanner}>
          <Shield size={16} color="#d4a843" strokeWidth={1.5} style={{ marginTop: 1 }} />
          <View style={s.securityText}>
            <Text style={s.securityTitle}>Manage your sessions</Text>
            <Text style={s.securitySub}>
              These devices have access to your Cheese Pay account. Remove any device you don't recognise immediately.
            </Text>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#d4a843" />
          </View>
        )}

        {/* Error */}
        {!loading && error && devices.length === 0 && (
          <View style={s.errorCard}>
            <AlertTriangle size={22} color="rgba(248,113,113,0.7)" strokeWidth={1.5} />
            <Text style={s.errorText}>Could not load devices</Text>
            <TouchableOpacity
              onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}
            >
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Device list */}
        {!loading && devices.length > 0 && (
          <>
            {/* Current device */}
            {currentDevice && (
              <View style={s.group}>
                <Text style={s.groupLabel}>Current device</Text>
                <DeviceRow
                  device={currentDevice}
                  onRevoke={() => setConfirmTarget({ id: currentDevice.id, name: currentDevice.deviceName })}
                  revoking={revokingId === currentDevice.id}
                />
              </View>
            )}

            {/* Other devices */}
            {otherDevices.length > 0 && (
              <View style={s.group}>
                <View style={s.groupHeader}>
                  <Text style={s.groupLabel}>Other devices</Text>
                  <Text style={s.groupCount}>{otherDevices.length}</Text>
                </View>
                <View style={s.deviceList}>
                  {otherDevices.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      onRevoke={() => setConfirmTarget({ id: device.id, name: device.deviceName })}
                      revoking={revokingId === device.id}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* No other devices */}
            {otherDevices.length === 0 && (
              <View style={s.emptyCard}>
                <CheckCircle size={26} color="#4ade80" strokeWidth={1.5} style={{ marginBottom: 4 }} />
                <Text style={s.emptyTitle}>Only this device has access</Text>
                <Text style={s.emptySub}>No other sessions are active on your account.</Text>
              </View>
            )}
          </>
        )}

      </ScrollView>

      <ConfirmModal
        target={confirmTarget}
        revoking={!!revokingId}
        onConfirm={handleRevoke}
        onCancel={() => setConfirmTarget(null)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, paddingBottom: 40 },

  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  backBtn:   {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:     { fontSize: 18, fontWeight: '600', color: '#fff', letterSpacing: -0.3 },

  securityBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'rgba(212,168,67,0.05)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)',
    padding: 14, marginBottom: 24,
  },
  securityText:  { flex: 1, gap: 3 },
  securityTitle: { fontSize: 12, fontWeight: '600', color: '#d4a843' },
  securitySub:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17 },

  loadingWrap: { paddingVertical: 48, alignItems: 'center' },

  errorCard:  {
    backgroundColor: 'rgba(248,113,113,0.05)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.1)',
    padding: 24, alignItems: 'center', gap: 8,
  },
  errorText:  { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  retryText:  { fontSize: 13, color: '#d4a843', fontWeight: '500', marginTop: 4 },

  group:       { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  groupLabel:  {
    fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  groupCount:  { fontSize: 10, color: 'rgba(255,255,255,0.2)', marginBottom: 8 },
  deviceList:  { gap: 8 },

  emptyCard:  {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 28, alignItems: 'center', gap: 6,
  },
  emptyTitle: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  emptySub:   { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },
})
