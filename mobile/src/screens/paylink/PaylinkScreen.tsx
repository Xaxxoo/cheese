import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  FlatList, RefreshControl, ActivityIndicator, Share, Modal,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import {
  createPayLink, getMyPayLinks, cancelPayLink,
} from '../../api/wallet'
import { fmtUsdc, fmtDateTime } from '../../utils/format'
import type { CreatePayLinkResponse, PayLinkData } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Paylink'>
type Tab = 'create' | 'links'

// ── Helpers ───────────────────────────────────────────────

function statusColor(status: PayLinkData['status']): string {
  switch (status) {
    case 'paid':      return '#4ade80'
    case 'pending':   return '#facc15'
    case 'expired':   return 'rgba(255,255,255,0.25)'
    case 'cancelled': return '#f87171'
    default:          return 'rgba(255,255,255,0.25)'
  }
}

function statusLabel(status: PayLinkData['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

// ── Link detail modal ─────────────────────────────────────

function LinkModal({
  link, onClose, onCancel,
}: {
  link: PayLinkData
  onClose: () => void
  onCancel: (token: string) => void
}) {
  const [cancelling, setCancelling] = useState(false)

  async function handleShare() {
    try { await Share.share({ message: link.url }) } catch { /* dismissed */ }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await cancelPayLink(link.token)
      onCancel(link.token)
      onClose()
    } catch { /* ignore */ } finally {
      setCancelling(false)
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.sheet}>
          <View style={m.handle} />

          <View style={m.amountRow}>
            <Text style={m.amount}>{fmtUsdc(link.amountUsdc)}</Text>
            <View style={[m.badge, { backgroundColor: statusColor(link.status) + '1a' }]}>
              <Text style={[m.badgeText, { color: statusColor(link.status) }]}>
                {statusLabel(link.status)}
              </Text>
            </View>
          </View>

          {link.note ? <Text style={m.note}>{link.note}</Text> : null}

          <View style={m.infoCard}>
            {[
              { label: 'Created',  value: fmtDateTime(link.createdAt) },
              { label: 'Expires',  value: fmtDateTime(link.expiresAt) },
              ...(link.paidAt  ? [{ label: 'Paid at', value: fmtDateTime(link.paidAt) }] : []),
              ...(link.payer   ? [{ label: 'Paid by', value: `@${link.payer.username}` }] : []),
            ].map(({ label, value }) => (
              <View key={label} style={m.row}>
                <Text style={m.rowLabel}>{label}</Text>
                <Text style={m.rowValue}>{value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={m.urlBox} onPress={handleShare}>
            <Text style={m.urlText} numberOfLines={1} ellipsizeMode="middle">{link.url}</Text>
            <Text style={m.urlHint}>Tap to share</Text>
          </TouchableOpacity>

          {link.status === 'pending' && (
            <TouchableOpacity
              style={[m.cancelBtn, cancelling && m.cancelBtnDisabled]}
              onPress={handleCancel}
              disabled={cancelling}
            >
              {cancelling
                ? <ActivityIndicator color="#f87171" size="small" />
                : <Text style={m.cancelBtnText}>Cancel Link</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity style={m.closeBtn} onPress={onClose}>
            <Text style={m.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: '1h',  hours: 1   },
  { label: '6h',  hours: 6   },
  { label: '24h', hours: 24  },
  { label: '7d',  hours: 168 },
]

export default function PaylinkScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('create')

  // ── Create ──
  const [amount,       setAmount]       = useState('')
  const [note,         setNote]         = useState('')
  const [expiryHours,  setExpiryHours]  = useState(24)
  const [creating,     setCreating]     = useState(false)
  const [createError,  setCreateError]  = useState<string | null>(null)
  const [created,      setCreated]      = useState<CreatePayLinkResponse | null>(null)

  // ── My links ──
  const [links,        setLinks]        = useState<PayLinkData[]>([])
  const [loading,      setLoading]      = useState(false)
  const [refreshing,   setRefreshing]   = useState(false)
  const [page,         setPage]         = useState(1)
  const [totalPages,   setTotalPages]   = useState(1)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [selected,     setSelected]     = useState<PayLinkData | null>(null)

  const loadLinks = useCallback(async (p: number, replace: boolean) => {
    try {
      const res = await getMyPayLinks(p, 20)
      setLinks((prev) => replace ? res.data : [...prev, ...res.data])
      setPage(p)
      setTotalPages(Math.ceil(res.total / res.pageSize))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (tab !== 'links') return
    setLoading(true)
    loadLinks(1, true).finally(() => setLoading(false))
  }, [tab, loadLinks])

  async function onRefresh() {
    setRefreshing(true)
    await loadLinks(1, true)
    setRefreshing(false)
  }

  async function loadMore() {
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)
    await loadLinks(page + 1, false)
    setLoadingMore(false)
  }

  // ── Create handler ──

  async function handleCreate() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { setCreateError('Enter a valid USDC amount'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await createPayLink({
        amountUsdc:     amt.toFixed(6),
        note:           note.trim() || undefined,
        expiresInHours: expiryHours,
      })
      setCreated(res)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to create pay link'
      setCreateError(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleShare(url: string) {
    try { await Share.share({ message: url }) } catch { /* dismissed */ }
  }

  function handleCancelled(token: string) {
    setLinks((prev) => prev.map((l) => l.token === token ? { ...l, status: 'cancelled' } : l))
  }

  // ── Render ──

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Pay Link</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'create' && s.tabBtnActive]}
          onPress={() => { setTab('create'); setCreated(null); setCreateError(null) }}
        >
          <Text style={[s.tabBtnText, tab === 'create' && s.tabBtnTextActive]}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'links' && s.tabBtnActive]}
          onPress={() => setTab('links')}
        >
          <Text style={[s.tabBtnText, tab === 'links' && s.tabBtnTextActive]}>My Links</Text>
        </TouchableOpacity>
      </View>

      {/* ── Create tab ── */}
      {tab === 'create' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
          <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

            {/* Success card */}
            {created ? (
              <View style={s.createdCard}>
                <Text style={s.createdIcon}>🔗</Text>
                <Text style={s.createdTitle}>Link Created!</Text>
                <Text style={s.createdAmount}>{fmtUsdc(created.amountUsdc)}</Text>
                {created.note ? <Text style={s.createdNote}>{created.note}</Text> : null}

                <TouchableOpacity style={s.urlBox} onPress={() => handleShare(created.url)}>
                  <Text style={s.urlText} numberOfLines={2}>{created.url}</Text>
                  <Text style={s.urlHint}>Tap to share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.shareBtn} onPress={() => handleShare(created.url)}>
                  <Text style={s.shareBtnText}>Share Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.anotherBtn}
                  onPress={() => { setCreated(null); setAmount(''); setNote(''); setExpiryHours(24) }}
                >
                  <Text style={s.anotherBtnText}>Create Another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.fieldLabel}>Amount (USDC)</Text>
                <TextInput
                  style={[s.input, s.amountInput]}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={amount}
                  onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, '')); setCreateError(null) }}
                  keyboardType="decimal-pad"
                  editable={!creating}
                />

                <Text style={s.fieldLabel}>Note (optional)</Text>
                <TextInput
                  style={s.input}
                  placeholder="What's this for?"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={note}
                  onChangeText={setNote}
                  maxLength={100}
                  editable={!creating}
                />

                <Text style={s.fieldLabel}>Expires In</Text>
                <View style={s.expiryRow}>
                  {EXPIRY_OPTIONS.map(({ label, hours }) => (
                    <TouchableOpacity
                      key={label}
                      style={[s.expiryBtn, expiryHours === hours && s.expiryBtnActive]}
                      onPress={() => setExpiryHours(hours)}
                    >
                      <Text style={[s.expiryBtnText, expiryHours === hours && s.expiryBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {createError ? <Text style={s.errorText}>{createError}</Text> : null}

                <TouchableOpacity
                  style={[s.createBtn, creating && s.createBtnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating
                    ? <ActivityIndicator color="#000" />
                    : <Text style={s.createBtnText}>Create Pay Link</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── My Links tab ── */}
      {tab === 'links' && (
        loading ? (
          <View style={s.center}><ActivityIndicator color="#d4a843" size="large" /></View>
        ) : (
          <FlatList
            data={links}
            keyExtractor={(item) => item.id}
            contentContainerStyle={links.length === 0 ? s.emptyContainer : s.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.linkRow} onPress={() => setSelected(item)} activeOpacity={0.7}>
                <View style={s.linkLeft}>
                  <Text style={s.linkAmount}>{fmtUsdc(item.amountUsdc)}</Text>
                  {item.note ? <Text style={s.linkNote} numberOfLines={1}>{item.note}</Text> : null}
                  <Text style={s.linkDate}>{fmtDateTime(item.createdAt)}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(item.status) + '1a' }]}>
                  <Text style={[s.statusText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🔗</Text>
                <Text style={s.emptyTitle}>No pay links yet</Text>
                <Text style={s.emptyText}>Create a pay link and share it to request payment.</Text>
              </View>
            }
            ListFooterComponent={
              page < totalPages ? (
                <TouchableOpacity style={s.loadMore} onPress={loadMore} disabled={loadingMore}>
                  {loadingMore
                    ? <ActivityIndicator color="#d4a843" />
                    : <Text style={s.loadMoreText}>Load more</Text>
                  }
                </TouchableOpacity>
              ) : null
            }
          />
        )
      )}

      {selected ? (
        <LinkModal
          link={selected}
          onClose={() => setSelected(null)}
          onCancel={handleCancelled}
        />
      ) : null}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#0a0a0a' },
  kav:               { flex: 1 },
  header:            { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backText:          { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 10 },
  title:             { fontSize: 22, fontWeight: '700', color: '#fff' },

  tabRow:            { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4,
                       backgroundColor: '#141414', borderRadius: 14, padding: 4,
                       borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabBtn:            { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabBtnActive:      { backgroundColor: '#d4a843' },
  tabBtnText:        { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabBtnTextActive:  { color: '#000' },

  container:         { flexGrow: 1, padding: 20, paddingBottom: 48 },
  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },

  fieldLabel:        { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                       textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:             {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 20,
  },
  amountInput:       { fontSize: 32, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },

  expiryRow:         { flexDirection: 'row', gap: 10, marginBottom: 24 },
  expiryBtn:         {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#141414', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  expiryBtnActive:   { backgroundColor: '#d4a843', borderColor: '#d4a843' },
  expiryBtnText:     { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  expiryBtnTextActive:{ color: '#000' },

  errorText:         { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },

  createBtn:         {
    backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
    alignItems: 'center', minHeight: 52, justifyContent: 'center',
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText:     { color: '#000', fontWeight: '700', fontSize: 15 },

  createdCard:       {
    backgroundColor: '#141414', borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  createdIcon:       { fontSize: 44, marginBottom: 12 },
  createdTitle:      { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  createdAmount:     { fontSize: 32, fontWeight: '700', color: '#4ade80', marginBottom: 4, letterSpacing: -0.5 },
  createdNote:       { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  urlBox:            {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    width: '100%', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  urlText:           { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', marginBottom: 4 },
  urlHint:           { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  shareBtn:          {
    backgroundColor: '#d4a843', borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  shareBtnText:      { color: '#000', fontWeight: '700', fontSize: 15 },
  anotherBtn:        {
    paddingVertical: 12, paddingHorizontal: 32, width: '100%', alignItems: 'center',
  },
  anotherBtnText:    { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  listContent:       { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12 },
  emptyContainer:    { flexGrow: 1 },
  separator:         { height: 8 },

  linkRow:           {
    backgroundColor: '#141414', borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  linkLeft:          { flex: 1, marginRight: 12 },
  linkAmount:        { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  linkNote:          { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  linkDate:          { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  statusBadge:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText:        { fontSize: 12, fontWeight: '600' },

  empty:             { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, paddingTop: 60 },
  emptyIcon:         { fontSize: 44, marginBottom: 16 },
  emptyTitle:        { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText:         { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 20 },

  loadMore:          {
    margin: 16, padding: 14, borderRadius: 14,
    backgroundColor: '#141414', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  loadMoreText:      { color: '#d4a843', fontWeight: '600', fontSize: 14 },
})

const m = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:            {
    backgroundColor: '#141414', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle:           {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20,
  },
  amountRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  amount:           { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  badge:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText:        { fontSize: 12, fontWeight: '600' },
  note:             { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 20 },
  infoCard:         {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4, marginBottom: 16,
  },
  row:              {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel:         { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  rowValue:         { fontSize: 13, color: '#fff', fontWeight: '500' },
  urlBox:           {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  urlText:          { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', marginBottom: 4 },
  urlHint:          { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  cancelBtn:        {
    padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 10,
    backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
  },
  cancelBtnDisabled:{ opacity: 0.6 },
  cancelBtnText:    { color: '#f87171', fontWeight: '700', fontSize: 15 },
  closeBtn:         {
    padding: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  closeBtnText:     { color: '#fff', fontWeight: '600', fontSize: 15 },
})
