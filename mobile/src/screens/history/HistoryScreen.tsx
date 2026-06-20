import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  RefreshControl, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView,
} from 'react-native'
import { getTransactions } from '../../api/wallet'
import { fmtUsdc, fmtNgn, fmtDateTime } from '../../utils/format'
import type { Transaction } from '../../types'

// ── Helpers ───────────────────────────────────────────────

function txIcon(type: Transaction['type']): string {
  switch (type) {
    case 'deposit':                      return '↓'
    case 'withdrawal':
    case 'send_username':
    case 'send_address':                 return '↑'
    case 'bank_transfer':                return '🏦'
    case 'bill_payment':                 return '⚡'
    case 'card_payment':                 return '💳'
    case 'referral_bonus':
    case 'yield_credit':                 return '🎁'
    case 'pay_request':                  return '🔗'
    default:                             return '•'
  }
}

function txIconColor(type: Transaction['type']): string {
  switch (type) {
    case 'deposit':
    case 'referral_bonus':
    case 'yield_credit':  return '#4ade80'
    default:              return '#f87171'
  }
}

function txLabel(tx: Transaction): string {
  switch (tx.type) {
    case 'deposit':        return 'Deposit'
    case 'withdrawal':     return 'Withdrawal'
    case 'send_username':  return tx.recipientUsername ? `To @${tx.recipientUsername}` : 'Sent'
    case 'send_address':   return 'Sent to address'
    case 'bank_transfer':  return tx.bank ?? 'Bank Transfer'
    case 'bill_payment':   return tx.description ?? 'Bill Payment'
    case 'card_payment':   return 'Card Payment'
    case 'referral_bonus': return 'Referral Bonus'
    case 'yield_credit':   return 'Yield Credit'
    case 'pay_request':    return 'Pay Request'
    case 'fee':            return 'Fee'
    default:               return tx.description ?? 'Transaction'
  }
}

function txAmount(tx: Transaction): string {
  const isCredit = tx.type === 'deposit' || tx.type === 'referral_bonus' || tx.type === 'yield_credit'
  return `${isCredit ? '+' : '-'}${fmtUsdc(tx.amountUsdc)}`
}

function txAmountColor(tx: Transaction): string {
  if (tx.status === 'failed' || tx.status === 'reversed') return 'rgba(255,255,255,0.3)'
  return tx.type === 'deposit' || tx.type === 'referral_bonus' || tx.type === 'yield_credit'
    ? '#4ade80' : '#fff'
}

function statusColor(status: Transaction['status']): string {
  switch (status) {
    case 'completed': return '#4ade80'
    case 'pending':   return '#facc15'
    case 'failed':
    case 'reversed':  return '#f87171'
    default:          return 'rgba(255,255,255,0.3)'
  }
}

// ── Filter config ─────────────────────────────────────────

type FilterKey = 'all' | 'received' | 'sent' | 'bank' | 'bills' | 'cards'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'received', label: 'Received' },
  { key: 'sent',     label: 'Sent'     },
  { key: 'bank',     label: 'Bank'     },
  { key: 'bills',    label: 'Bills'    },
  { key: 'cards',    label: 'Cards'    },
]

function matchesFilter(tx: Transaction, filter: FilterKey): boolean {
  switch (filter) {
    case 'received': return ['deposit', 'referral_bonus', 'yield_credit'].includes(tx.type)
    case 'sent':     return ['send_username', 'send_address', 'withdrawal'].includes(tx.type)
    case 'bank':     return tx.type === 'bank_transfer'
    case 'bills':    return tx.type === 'bill_payment'
    case 'cards':    return tx.type === 'card_payment'
    default:         return true
  }
}

// ── Detail Modal ──────────────────────────────────────────

function DetailModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const rows: { label: string; value: string | null }[] = [
    { label: 'Reference',   value: tx.reference },
    { label: 'Status',      value: tx.status.charAt(0).toUpperCase() + tx.status.slice(1) },
    { label: 'Amount',      value: fmtUsdc(tx.amountUsdc) },
    { label: 'NGN Amount',  value: tx.amountNgn ? fmtNgn(tx.amountNgn) : null },
    { label: 'Fee',         value: parseFloat(tx.fee) > 0 ? fmtUsdc(tx.fee) : 'None' },
    { label: 'Rate',        value: tx.rateApplied ? `₦${tx.rateApplied}` : null },
    { label: 'Recipient',   value: tx.recipientUsername ? `@${tx.recipientUsername}` : tx.recipientName ?? null },
    { label: 'Bank',        value: tx.bank ?? null },
    { label: 'Account No.', value: tx.accountNumber ?? null },
    { label: 'Network',     value: tx.network ?? null },
    { label: 'Tx Hash',     value: tx.txHash ?? null },
    { label: 'Date',        value: fmtDateTime(tx.createdAt) },
  ]

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={d.overlay}>
        <View style={d.sheet}>
          <View style={d.handle} />
          <Text style={d.title}>{txLabel(tx)}</Text>
          <Text style={[d.amount, { color: txAmountColor(tx) }]}>{txAmount(tx)}</Text>

          <ScrollView style={d.scroll} showsVerticalScrollIndicator={false}>
            {rows.filter((r) => r.value !== null).map((r) => (
              <View key={r.label} style={d.row}>
                <Text style={d.rowLabel}>{r.label}</Text>
                <Text style={d.rowValue} selectable numberOfLines={1} ellipsizeMode="middle">
                  {r.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={d.closeBtn} onPress={onClose}>
            <Text style={d.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────

const PAGE_SIZE = 20

export default function HistoryScreen() {
  const [allTxs,     setAllTxs]     = useState<Transaction[]>([])
  const [page,       setPage]        = useState(1)
  const [totalPages, setTotalPages]  = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [loadingMore,setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [filter,     setFilter]     = useState<FilterKey>('all')
  const [selected,   setSelected]   = useState<Transaction | null>(null)

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    try {
      const res = await getTransactions(p, PAGE_SIZE)
      setAllTxs((prev) => replace ? res.items : [...prev, ...res.items])
      setPage(res.page)
      setTotalPages(res.totalPages)
      setError(null)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to load transactions'
      setError(msg)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchPage(1, true).finally(() => setLoading(false))
  }, [fetchPage])

  async function onRefresh() {
    setRefreshing(true)
    await fetchPage(1, true)
    setRefreshing(false)
  }

  async function loadMore() {
    if (loadingMore || page >= totalPages) return
    setLoadingMore(true)
    await fetchPage(page + 1, false)
    setLoadingMore(false)
  }

  const filtered = useMemo(
    () => allTxs.filter((tx) => matchesFilter(tx, filter)),
    [allTxs, filter],
  )

  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <TouchableOpacity style={s.txRow} onPress={() => setSelected(item)} activeOpacity={0.7}>
      <View style={[s.txIconWrap, { backgroundColor: txIconColor(item.type) + '1a' }]}>
        <Text style={[s.txIcon, { color: txIconColor(item.type) }]}>{txIcon(item.type)}</Text>
      </View>
      <View style={s.txMeta}>
        <Text style={s.txLabel} numberOfLines={1}>{txLabel(item)}</Text>
        <View style={s.txSubRow}>
          <View style={[s.statusDot, { backgroundColor: statusColor(item.status) }]} />
          <Text style={s.txDate}>{fmtDateTime(item.createdAt)}</Text>
        </View>
      </View>
      <Text style={[s.txAmount, { color: txAmountColor(item) }]}>{txAmount(item)}</Text>
    </TouchableOpacity>
  ), [])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>History</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
        style={s.filtersWrap}
      >
        {FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[s.chip, filter === key && s.chipActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[s.chipText, filter === key && s.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#d4a843" size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); fetchPage(1, true).finally(() => setLoading(false)) }}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? s.emptyContainer : s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No transactions found</Text>
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
      )}

      {selected ? <DetailModal tx={selected} onClose={() => setSelected(null)} /> : null}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0a0a0a' },
  header:       { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title:        { fontSize: 22, fontWeight: '700', color: '#fff' },

  filtersWrap:  { maxHeight: 52, marginBottom: 8 },
  filtersRow:   { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  chip:         {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#141414',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive:   { backgroundColor: '#d4a843', borderColor: '#d4a843' },
  chipText:     { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  chipTextActive:{ color: '#000' },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText:    { color: '#ff6b6b', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn:     { backgroundColor: '#d4a843', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:    { color: '#000', fontWeight: '700', fontSize: 14 },

  listContent:  { paddingHorizontal: 20, paddingBottom: 32 },
  emptyContainer:{ flexGrow: 1, paddingHorizontal: 20 },

  separator:    { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 0 },

  txRow:        {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, backgroundColor: '#141414',
    paddingHorizontal: 14, borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  txIconWrap:   {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txIcon:       { fontSize: 17, fontWeight: '700' },
  txMeta:       { flex: 1, marginRight: 8 },
  txLabel:      { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 3 },
  txSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  txDate:       { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  txAmount:     { fontSize: 14, fontWeight: '600' },

  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText:    { color: 'rgba(255,255,255,0.25)', fontSize: 14 },

  loadMore:     {
    margin: 16, padding: 14, borderRadius: 14,
    backgroundColor: '#141414', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  loadMoreText: { color: '#d4a843', fontWeight: '600', fontSize: 14 },
})

const d = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:       {
    backgroundColor: '#141414', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, maxHeight: '80%',
  },
  handle:      {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20,
  },
  title:       { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 4 },
  amount:      { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 24, letterSpacing: -0.5 },
  scroll:      { marginBottom: 16 },
  row:         {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  rowValue:    { fontSize: 13, color: '#fff', fontWeight: '500', flex: 2, textAlign: 'right' },
  closeBtn:    {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  closeBtnText:{ color: '#fff', fontWeight: '600', fontSize: 15 },
})
