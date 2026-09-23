import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native'
import {
  ArrowLeft, TrendingUp, ChevronRight, Clock, Shield,
  Gift, Info,
} from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { useAuthStore } from '../../store/auth.store'
import { getYieldStatus, enrollYield, unenrollYield, getYieldHistory } from '../../api/wallet'
import { fmtUsdc, fmtDate } from '../../utils/format'
import type { YieldStatus, Transaction } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Earn'>

export default function EarnScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)
  const isVerified = user?.kycStatus === 'verified'
  const [status, setStatus]       = useState<YieldStatus | null>(null)
  const [history, setHistory]     = useState<Transaction[]>([])
  const [loading, setLoading]     = useState(true)
  const [toggling, setToggling]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [calcAmount, setCalcAmount] = useState('')
  const [calcTier, setCalcTier]     = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        getYieldStatus(),
        getYieldHistory().catch(() => ({ items: [] as Transaction[] })),
      ])
      setStatus(s)
      setHistory(h.items.slice(0, 10))
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

  async function handleToggle() {
    if (!status) return

    if (status.enrolled) {
      Alert.alert(
        'Disable Earn',
        'You will stop earning yield on your USDC balance. You can re-enable anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable', style: 'destructive', onPress: async () => {
              setToggling(true)
              try {
                await unenrollYield()
                await load()
              } catch (e: unknown) {
                const msg =
                  (e as { response?: { data?: { message?: string } } })?.response?.data?.message
                  ?? 'Failed to unenroll'
                Alert.alert('Error', msg)
              } finally {
                setToggling(false)
              }
            },
          },
        ],
      )
    } else {
      setToggling(true)
      try {
        await enrollYield()
        await load()
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'Failed to enroll'
        Alert.alert('Error', msg)
      } finally {
        setToggling(false)
      }
    }
  }

  const tierLabel = status ? status.tier.charAt(0).toUpperCase() + status.tier.slice(1) : ''

  const TIER_APYS: Record<string, number> = { silver: 5, gold: 5.5, black: 6 }
  const effectiveTier = calcTier ?? status?.tier ?? 'silver'
  const calcApy = TIER_APYS[effectiveTier] / 100
  const calcNum = parseFloat(calcAmount.replace(/,/g, '')) || 0
  const projDaily = calcNum * calcApy / 365
  const projMonthly = calcNum * calcApy / 12
  const projYearly = calcNum * calcApy

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4a843" />}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <ArrowLeft size={22} color="#fff" strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Earn</Text>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <ActivityIndicator color="#d4a843" size="large" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : status ? (
          <>
            {/* APY Card */}
            <View style={s.apyCard}>
              <View style={s.apyIconWrap}>
                <TrendingUp size={28} color="#d4a843" strokeWidth={1.5} />
              </View>
              <Text style={s.apyLabel}>Annual Percentage Yield</Text>
              <Text style={s.apyRate}>{status.apyRate}%</Text>
              <View style={s.tierBadge}>
                <Text style={s.tierBadgeText}>{tierLabel} Tier</Text>
              </View>
            </View>

            {/* Enrollment toggle */}
            {isVerified ? (
              <TouchableOpacity
                style={[s.toggleBtn, status.enrolled && s.toggleBtnActive]}
                onPress={handleToggle}
                disabled={toggling}
                activeOpacity={0.7}
              >
                {toggling ? (
                  <ActivityIndicator color={status.enrolled ? '#0a0a0a' : '#d4a843'} />
                ) : (
                  <Text style={[s.toggleBtnText, status.enrolled && s.toggleBtnTextActive]}>
                    {status.enrolled ? 'Earning Enabled' : 'Re-enable Earning'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={s.toggleBtn}
                onPress={() => navigation.navigate('Kyc')}
                activeOpacity={0.7}
              >
                <Text style={s.toggleBtnText}>Verify Identity to Start Earning</Text>
              </TouchableOpacity>
            )}

            {/* Stats grid */}
            <View style={s.statsGrid}>
              <View style={s.statBox}>
                <Gift size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                <Text style={s.statLabel}>Total Earned</Text>
                <Text style={s.statValue}>{fmtUsdc(status.totalEarned)}</Text>
              </View>
              <View style={s.statBox}>
                <Shield size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                <Text style={s.statLabel}>Balance</Text>
                <Text style={s.statValue}>{fmtUsdc(status.balanceUsdc)}</Text>
              </View>
            </View>

            {status.lastDistributionAt && (
              <View style={s.lastPaid}>
                <Clock size={13} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
                <Text style={s.lastPaidText}>
                  Last credit: {fmtDate(status.lastDistributionAt)}
                </Text>
              </View>
            )}

            {/* Info section */}
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Info size={14} color="#d4a843" strokeWidth={1.5} />
                <Text style={s.infoTitle}>How it works</Text>
              </View>
              <Text style={s.infoText}>
                Your USDC earns yield daily through Blend Capital on Stellar.
                Yield is credited to your wallet automatically at 2:00 AM UTC every day.
                A minimum balance of ${status.minBalanceUsdc} USDC is required.
              </Text>
              <View style={s.infoSep} />
              <View style={s.tierInfo}>
                <View style={s.tierInfoRow}>
                  <Text style={s.tierInfoLabel}>Silver</Text>
                  <Text style={s.tierInfoValue}>5.0% APY</Text>
                </View>
                <View style={s.tierInfoRow}>
                  <Text style={s.tierInfoLabel}>Gold</Text>
                  <Text style={s.tierInfoValue}>5.5% APY</Text>
                </View>
                <View style={s.tierInfoRow}>
                  <Text style={s.tierInfoLabel}>Black</Text>
                  <Text style={s.tierInfoValue}>6.0% APY</Text>
                </View>
              </View>
            </View>

            {/* Yield Calculator */}
            <View style={s.calcCard}>
              <Text style={s.calcTitle}>Yield Calculator</Text>
              <TextInput
                style={s.calcInput}
                placeholder="Enter USDC amount"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                value={calcAmount}
                onChangeText={(val: string) => setCalcAmount(val.replace(/[^0-9.,]/g, ''))}
                onBlur={() => {
                  const num = parseFloat(calcAmount.replace(/,/g, ''))
                  if (!isNaN(num) && num > 0) setCalcAmount(num.toLocaleString('en-US'))
                }}
              />
              <View style={s.calcTiers}>
                {([
                  { key: 'silver', label: 'Silver', apy: 5 },
                  { key: 'gold', label: 'Gold', apy: 5.5 },
                  { key: 'black', label: 'Black', apy: 6 },
                ] as const).map(({ key, label, apy }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.calcTierBtn, effectiveTier === key && s.calcTierBtnActive]}
                    onPress={() => setCalcTier(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.calcTierText, effectiveTier === key && s.calcTierTextActive]}>
                      {label} ({apy}%)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.calcResults}>
                {([
                  { label: 'Daily', value: projDaily },
                  { label: 'Monthly', value: projMonthly },
                  { label: 'Yearly', value: projYearly },
                ]).map(({ label, value }) => (
                  <View key={label} style={s.calcResultBox}>
                    <Text style={s.calcResultLabel}>{label}</Text>
                    <Text style={s.calcResultValue}>${value.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent yield credits */}
            {history.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Recent Earnings</Text>
                {history.map((tx) => (
                  <View key={tx.id} style={s.txRow}>
                    <View style={s.txIconWrap}>
                      <Gift size={16} color="#4ade80" strokeWidth={1.5} />
                    </View>
                    <View style={s.txMeta}>
                      <Text style={s.txLabel}>Yield Credit</Text>
                      <Text style={s.txDate}>{fmtDate(tx.createdAt)}</Text>
                    </View>
                    <Text style={s.txAmount}>+{fmtUsdc(tx.amountUsdc)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#0a0a0a' },
  container:  { padding: 20, paddingBottom: 40 },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn:    { width: 36, height: 36, borderRadius: 12, backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: 17, fontWeight: '600', color: '#fff' },

  errorBanner: { backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10, padding: 12, marginTop: 20 },
  errorText:   { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },

  // APY card
  apyCard:    {
    backgroundColor: '#141414', borderRadius: 20,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)',
  },
  apyIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(212,168,67,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  apyLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  apyRate:    { fontSize: 48, fontWeight: '700', color: '#d4a843', letterSpacing: -2, marginBottom: 12 },
  tierBadge:  {
    backgroundColor: 'rgba(212,168,67,0.12)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  tierBadgeText: { fontSize: 11, fontWeight: '600', color: '#d4a843', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Toggle button
  toggleBtn:  {
    marginTop: 20, borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#d4a843',
    minHeight: 52, justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#d4a843', borderColor: '#d4a843',
  },
  toggleBtnText:       { fontSize: 15, fontWeight: '600', color: '#d4a843' },
  toggleBtnTextActive: { color: '#0a0a0a' },

  // Stats
  statsGrid:  { flexDirection: 'row', gap: 12, marginTop: 24 },
  statBox:    {
    flex: 1, backgroundColor: '#141414', borderRadius: 16,
    padding: 16, gap: 6, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:  { fontSize: 16, fontWeight: '700', color: '#fff' },

  lastPaid:   { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 16 },
  lastPaidText: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  // Info card
  infoCard:   {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  infoTitle:  { fontSize: 14, fontWeight: '600', color: '#fff' },
  infoText:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  infoSep:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 },
  tierInfo:   { gap: 8 },
  tierInfoRow:{ flexDirection: 'row', justifyContent: 'space-between' },
  tierInfoLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  tierInfoValue: { fontSize: 13, fontWeight: '600', color: '#d4a843' },

  // Recent earnings
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 28, marginBottom: 12,
  },
  txRow:      {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  txIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txMeta:     { flex: 1, marginRight: 8 },
  txLabel:    { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 2 },
  txDate:     { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  txAmount:   { fontSize: 14, fontWeight: '600', color: '#4ade80' },

  // Yield calculator
  calcCard: {
    backgroundColor: '#141414', borderRadius: 16,
    padding: 20, marginTop: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  calcTitle: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12,
  },
  calcInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: '#fff',
  },
  calcTiers: {
    flexDirection: 'row' as const, gap: 8, marginTop: 12,
  },
  calcTierBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 8,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  calcTierBtnActive: {
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderColor: 'rgba(212,168,67,0.4)',
  },
  calcTierText: {
    fontSize: 11, fontWeight: '600' as const, color: 'rgba(255,255,255,0.4)',
  },
  calcTierTextActive: {
    color: '#d4a843',
  },
  calcResults: {
    flexDirection: 'row' as const, gap: 8, marginTop: 16,
  },
  calcResultBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, padding: 12, alignItems: 'center' as const,
  },
  calcResultLabel: {
    fontSize: 10, fontWeight: '600' as const, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 4,
  },
  calcResultValue: {
    fontSize: 14, fontWeight: '700' as const, color: '#fff',
  },
})
