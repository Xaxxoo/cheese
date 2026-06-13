import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'Tabs'>

export default function DashboardScreen({ navigation }: Props) {
  const actions = [
    { label: 'Send',          emoji: '↑',  screen: 'Send'         },
    { label: 'Receive',       emoji: '↓',  screen: 'Receive'      },
    { label: 'Bank Transfer', emoji: '🏦', screen: 'BankTransfer' },
    { label: 'Pay Link',      emoji: '🔗', screen: 'Paylink'      },
    { label: 'Pay Bills',     emoji: '⚡', screen: 'Bills'        },
  ] as const

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.greeting}>Good morning 👋</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Text style={s.bell}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Balance card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Total Balance</Text>
          <Text style={s.balance}>$0.00</Text>
          <Text style={s.balanceSub}>≈ ₦0.00</Text>
        </View>

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

        {/* Recent transactions placeholder */}
        <Text style={s.sectionLabel}>Recent</Text>
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No recent transactions</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#0a0a0a' },
  container:   { padding: 20, paddingBottom: 40 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:    { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  bell:        { fontSize: 22 },
  balanceCard: {
    backgroundColor: '#141414', borderRadius: 20,
    padding: 24, marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  balanceLabel:{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  balance:     { fontSize: 42, fontWeight: '700', color: '#fff', letterSpacing: -1 },
  balanceSub:  { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 4 },
  sectionLabel:{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  actions:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  actionBtn:   {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 16, alignItems: 'center', width: '30%',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  actionEmoji: { fontSize: 22, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontWeight: '500' },
  emptyCard:   {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText:   { color: 'rgba(255,255,255,0.25)', fontSize: 13 },
})
