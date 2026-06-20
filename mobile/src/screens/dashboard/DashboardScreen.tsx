import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getBalance, getTransactions } from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { fmtUsdc, fmtNgn, fmtDate } from '../../utils/format'
import type { WalletBalance, Transaction } from '../../types'

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

export default function DashboardScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)

  const [balance,    setBalance]    = useState<WalletBalance | null>(null)
  const [txs,        setTxs]        = useState<Transaction[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [bal, txList] = await Promise.all([
        getBalance(),
        getTransactions(1, 5),
      ])
      setBalance(bal)
      setTxs(txList.items)
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
    load().finally(() => setLoading(false))
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const actions = [
    { label: 'Send',          emoji: '↑',  screen: 'Send'         },
    { label: 'Receive',       emoji: '↓',  screen: 'Receive'      },
    { label: 'Bank Transfer', emoji: '🏦', screen: 'BankTransfer' },
    { label: 'Pay Link',      emoji: '🔗', screen: 'Paylink'      },
    { label: 'Pay Bills',     emoji: '⚡', screen: 'Bills'        },
  ] as const

  const firstName = user?.fullName?.split(' ')[0] ?? user?.username ?? ''

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
      >
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
              <Text style={s.balance}>
                {balance ? balance.totalUsdcDisplay : '$0.00'}
              </Text>
              <Text style={s.balanceSub}>
                {balance ? `≈ ${fmtNgn(balance.ngnEquivalent)}` : '≈ ₦0.00'}
              </Text>
            </>
          )}
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
              onPress={() => navigation.navigate(screen as keyof AppStackParamList)}
            >
              <Text style={s.actionEmoji}>{emoji}</Text>
              <Text style={s.actionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent transactions */}
        <Text style={s.sectionLabel}>Recent</Text>

        {loading ? (
          <View style={s.emptyCard}>
            <ActivityIndicator color="#d4a843" />
          </View>
        ) : txs.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No recent transactions</Text>
          </View>
        ) : (
          <View style={s.txList}>
            {txs.map((tx) => (
              <View key={tx.id} style={s.txRow}>
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
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0a0a0a' },
  container:    { padding: 20, paddingBottom: 40 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:     { fontSize: 15, color: 'rgba(255,255,255,0.7)', fontWeight: '500', flex: 1 },
  bell:         { fontSize: 22 },

  balanceCard:  {
    backgroundColor: '#141414', borderRadius: 20,
    padding: 24, marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', minHeight: 110, justifyContent: 'center',
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  balance:      { fontSize: 42, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  balanceSub:   { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },

  errorBanner:  {
    backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10,
    padding: 12, marginBottom: 20,
  },
  errorText:    { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },

  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },

  actions:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  actionBtn:    {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 16, alignItems: 'center', width: '30%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionEmoji:  { fontSize: 22, marginBottom: 6 },
  actionLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontWeight: '500' },

  emptyCard:    {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText:    { color: 'rgba(255,255,255,0.25)', fontSize: 13 },

  txList:       {
    backgroundColor: '#141414', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  txRow:        {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  txIconWrap:   {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txIcon:       { fontSize: 16, fontWeight: '700' },
  txMeta:       { flex: 1, marginRight: 8 },
  txLabel:      { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 3 },
  txSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  txDate:       { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  txAmount:     { fontSize: 14, fontWeight: '600' },
})
