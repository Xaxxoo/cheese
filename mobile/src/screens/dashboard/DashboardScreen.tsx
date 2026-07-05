import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getBalance, getTransactions, getTransactionStats } from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { fmtUsdc, fmtNgn, fmtDate } from '../../utils/format'
import type { WalletBalance, Transaction, TransactionStats } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Tabs'>

// ── Helpers ───────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function txIcon(type: Transaction['type']): string {
  switch (type) {
    case 'deposit':                       return '↓'
    case 'withdrawal':
    case 'send_username':
    case 'send_address':                  return '↑'
    case 'bank_transfer':                 return '🏦'
    case 'bill_payment':                  return '⚡'
    case 'card_payment':                  return '💳'
    case 'referral_bonus':
    case 'yield_credit':                  return '🎁'
    case 'pay_request':                   return '🔗'
    default:                              return '•'
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
  const sign = isCredit ? '+' : '-'
  return `${sign}${fmtUsdc(tx.amountUsdc)}`
}

function txAmountColor(tx: Transaction): string {
  if (tx.status === 'failed' || tx.status === 'reversed') return 'rgba(255,255,255,0.3)'
  return tx.type === 'deposit' || tx.type === 'referral_bonus' || tx.type === 'yield_credit'
    ? '#4ade80'
    : '#fff'
}

function statusDot(status: Transaction['status']): string {
  switch (status) {
    case 'completed': return '#4ade80'
    case 'pending':   return '#facc15'
    case 'failed':
    case 'reversed':  return '#f87171'
    default:          return 'rgba(255,255,255,0.3)'
  }
}

// ── Component ─────────────────────────────────────────────

const PAGE_SIZE = 20

export default function DashboardScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)

  const [balance,     setBalance]     = useState<WalletBalance | null>(null)
  const [stats,       setStats]       = useState<TransactionStats | null>(null)
  const [txs,         setTxs]         = useState<Transaction[]>([])
  const [page,        setPage]        = useState(1)
  const [totalPages,  setTotalPages]  = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    try {
      const [bal, txRes, txStats] = await Promise.all([
        getBalance(),
        getTransactions(1, PAGE_SIZE),
        getTransactionStats(),
      ])
      setBalance(bal)
      setStats(txStats)
      setTxs(txRes.items)
      setPage(1)
      setTotalPages(txRes.totalPages)
      setError(null)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to load'
      setError(msg)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    loadInitial().finally(() => setLoading(false))
  }, [loadInitial])

  async function onRefresh() {
    setRefreshing(true)
    await loadInitial()
    setRefreshing(false)
  }

  async function loadMore() {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const txRes = await getTransactions(nextPage, PAGE_SIZE)
      setTxs((prev) => [...prev, ...txRes.items])
      setPage(nextPage)
      setTotalPages(txRes.totalPages)
    } catch {
      // silently ignore
    } finally {
      setLoadingMore(false)
    }
  }

  type NoParamScreen = 'Send' | 'Receive' | 'AddMoney' | 'BankTransfer' | 'Card' | 'Paylink' | 'Bills'
  const actions: { label: string; emoji: string; screen: NoParamScreen }[] = [
    { label: 'Send',          emoji: '↑',  screen: 'Send'         },
    { label: 'Receive',       emoji: '↓',  screen: 'Receive'      },
    { label: 'Add Money',     emoji: '＋', screen: 'AddMoney'     },
    { label: 'Bank Transfer', emoji: '🏦', screen: 'BankTransfer' },
    { label: 'My Card',       emoji: '💳', screen: 'Card'         },
    { label: 'Pay Link',      emoji: '🔗', screen: 'Paylink'      },
    { label: 'Pay Bills',     emoji: '⚡', screen: 'Bills'        },
  ]

  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? ''

  // ── Header component (everything above the tx list) ──
  const ListHeader = (
    <>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.greeting}>{greeting()}{firstName ? `, ${firstName}` : ''} 👋</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Text style={s.bell}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Balance card */}
      <View style={s.balanceCard}>
        <Text style={s.balanceLabel}>Total Balance</Text>
        {loading ? (
          <ActivityIndicator color="#d4a843" style={{ marginVertical: 12 }} />
        ) : (
          <>
            <Text style={s.balance}>{balance ? balance.totalUsdcDisplay : '$0.00'}</Text>
            <Text style={s.balanceSub}>{balance ? `≈ ${fmtNgn(balance.ngnEquivalent)}` : '≈ ₦0.00'}</Text>
          </>
        )}
      </View>

      {/* Inward / Outward stat cards */}
      <View style={s.statsRow}>
        <View style={[s.statCard, s.statCardIn]}>
          <Text style={s.statCardIcon}>↓</Text>
          <Text style={s.statCardLabel}>Total Received</Text>
          {loading || !stats ? (
            <ActivityIndicator color="#4ade80" size="small" style={{ marginTop: 6 }} />
          ) : (
            <Text style={[s.statCardAmount, { color: '#4ade80' }]}>{fmtUsdc(stats.totalInUsdc)}</Text>
          )}
        </View>
        <View style={[s.statCard, s.statCardOut]}>
          <Text style={s.statCardIcon}>↑</Text>
          <Text style={s.statCardLabel}>Total Sent</Text>
          {loading || !stats ? (
            <ActivityIndicator color="#f87171" size="small" style={{ marginTop: 6 }} />
          ) : (
            <Text style={[s.statCardAmount, { color: '#f87171' }]}>{fmtUsdc(stats.totalOutUsdc)}</Text>
          )}
        </View>
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Quick actions */}
      <Text style={s.sectionLabel}>Quick Actions</Text>
      <View style={s.actions}>
        {actions.map(({ label, emoji, screen }) => (
          <TouchableOpacity
            key={label}
            style={s.actionBtn}
            onPress={() => navigation.navigate(screen)}
          >
            <Text style={s.actionEmoji}>{emoji}</Text>
            <Text style={s.actionLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions header */}
      <View style={s.txHeader}>
        <Text style={s.sectionLabel}>Transactions</Text>
        {stats && <Text style={s.txCount}>{stats.txCount} total</Text>}
      </View>
    </>
  )

  const ListFooter = page < totalPages ? (
    <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
      {loadingMore
        ? <ActivityIndicator color="#d4a843" />
        : <Text style={s.loadMoreText}>Load more</Text>
      }
    </TouchableOpacity>
  ) : txs.length > 0 ? (
    <Text style={s.endText}>All transactions loaded</Text>
  ) : null

  return (
    <SafeAreaView style={s.safe}>
      <FlatList
        data={txs}
        keyExtractor={(tx) => tx.id}
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No transactions yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item: tx }) => (
          <View style={s.txRow}>
            <View style={[s.txIconWrap, { backgroundColor: txIconColor(tx.type) + '1a' }]}>
              <Text style={[s.txIcon, { color: txIconColor(tx.type) }]}>{txIcon(tx.type)}</Text>
            </View>
            <View style={s.txMeta}>
              <Text style={s.txLabel} numberOfLines={1}>{txLabel(tx)}</Text>
              <View style={s.txSubRow}>
                <View style={[s.statusDot, { backgroundColor: statusDot(tx.status) }]} />
                <Text style={s.txDate}>{fmtDate(tx.createdAt)}</Text>
              </View>
            </View>
            <Text style={[s.txAmount, { color: txAmountColor(tx) }]}>
              {txAmount(tx)}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0a0a0a' },
  container:     { padding: 20, paddingBottom: 40 },

  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:      { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  bell:          { fontSize: 22 },

  balanceCard:   {
    backgroundColor: '#141414', borderRadius: 20,
    padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', minHeight: 110, justifyContent: 'center',
  },
  balanceLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  balance:       { fontSize: 42, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  balanceSub:    { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },

  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 28 },
  statCard:      {
    flex: 1, borderRadius: 16, padding: 16,
    borderWidth: 1, alignItems: 'center',
  },
  statCardIn:    { backgroundColor: 'rgba(74,222,128,0.06)', borderColor: 'rgba(74,222,128,0.15)' },
  statCardOut:   { backgroundColor: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.15)' },
  statCardIcon:  { fontSize: 18, marginBottom: 6, color: 'rgba(255,255,255,0.5)' },
  statCardLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600',
                   textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statCardAmount:{ fontSize: 15, fontWeight: '700' },

  errorBanner:   {
    backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10,
    padding: 12, marginBottom: 20,
  },
  errorText:     { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },

  sectionLabel:  {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },

  actions:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  actionBtn:     {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 16, alignItems: 'center', width: '30%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionEmoji:   { fontSize: 22, marginBottom: 6 },
  actionLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontWeight: '500' },

  txHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  txCount:       { fontSize: 12, color: 'rgba(255,255,255,0.25)' },

  emptyCard:     {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText:     { color: 'rgba(255,255,255,0.25)', fontSize: 13 },

  txRow:         {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  separator:     { height: 6 },
  txIconWrap:    {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txIcon:        { fontSize: 16, fontWeight: '700' },
  txMeta:        { flex: 1, marginRight: 8 },
  txLabel:       { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 3 },
  txSubRow:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  txDate:        { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  txAmount:      { fontSize: 14, fontWeight: '600' },

  loadMoreBtn:   {
    marginTop: 12, padding: 14, borderRadius: 14,
    backgroundColor: '#141414', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  loadMoreText:  { color: '#d4a843', fontWeight: '600', fontSize: 14 },
  endText:       { textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 12, marginTop: 16 },
})
