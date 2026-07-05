import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import { ArrowLeft, Building2, TrendingUp, Info, Zap, Hexagon, ArrowRight } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { getVirtualAccount, getOnRampAvailability, getExchangeRate } from '../../api/wallet'
import type { VirtualAccount, OnRampAvailability, ExchangeRate } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'AddMoney'>
type Tab = 'bank' | 'crypto'
type CopiedField = 'number' | 'name' | 'all' | null

export default function AddMoneyScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('bank')

  const [account,      setAccount]      = useState<VirtualAccount | null>(null)
  const [availability, setAvailability] = useState<OnRampAvailability | null>(null)
  const [rate,         setRate]         = useState<ExchangeRate | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [ngnInput,     setNgnInput]     = useState('')
  const [copied,       setCopied]       = useState<CopiedField>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([getVirtualAccount(), getOnRampAvailability(), getExchangeRate()])
      .then(([acct, avail, rt]) => {
        setAccount(acct)
        setAvailability(avail)
        setRate(rt)
        setError(null)
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (e as Error)?.message
          ?? 'Failed to load'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCopy(field: CopiedField, text: string) {
    await Clipboard.setStringAsync(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const effectiveRate = rate ? Number(rate.effectiveRate) : null
  const estimatedUsdc =
    effectiveRate && ngnInput && !isNaN(parseFloat(ngnInput)) && parseFloat(ngnInput) > 0
      ? (parseFloat(ngnInput) / effectiveRate).toFixed(2)
      : null

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={s.title}>Add Money</Text>
        </View>

        {/* Tab switcher */}
        <View style={s.tabBar}>
          {(['bank', 'crypto'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[s.tabBtnText, tab === t && s.tabBtnTextActive]}>
                {t === 'bank' ? 'Bank Transfer' : 'Crypto'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Bank Transfer tab ──────────────────────────────── */}
        {tab === 'bank' && (
          <>
            {loading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator color="#d4a843" />
                <Text style={s.loadingText}>Setting up your account…</Text>
              </View>
            ) : !account ? (
              <View style={s.errorWrap}>
                <Building2 size={36} color="rgba(255,255,255,0.3)" strokeWidth={1.5} style={{ marginBottom: 4 }} />
                <Text style={s.errorTitle}>Could not load account</Text>
                <Text style={s.errorSub}>{error ?? 'Check your connection and try again'}</Text>
              </View>
            ) : (
              <>
                {/* Availability banner */}
                {availability && (
                  <View style={s.availBanner}>
                    <View>
                      <Text style={s.availLabel}>Available to buy</Text>
                      <Text style={s.availAmount}>
                        {availability.availableUsdcDisplay}
                        <Text style={s.availUnit}> USDC</Text>
                      </Text>
                    </View>
                    <TrendingUp size={22} color="#4ade80" strokeWidth={1.5} />
                  </View>
                )}

                {/* Account details card */}
                <View style={s.card}>
                  <View style={s.cardHeader}>
                    <View>
                      <Text style={s.cardLabel}>Your Deposit Account</Text>
                      <Text style={s.cardBank}>Pulse MFB</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.copyBtn, copied === 'all' && s.copyBtnActive]}
                      onPress={() =>
                        handleCopy(
                          'all',
                          `Bank: Pulse MFB\nAccount Number: ${account.accountNumber}\nAccount Name: ${account.accountName}`,
                        )
                      }
                    >
                      <Text style={[s.copyBtnText, copied === 'all' && s.copyBtnTextActive]}>
                        {copied === 'all' ? '✓ Copied' : 'Copy all'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.divider} />

                  {/* Bank row */}
                  <View style={s.detailRow}>
                    <View style={s.detailLeft}>
                      <Text style={s.detailLabel}>Bank</Text>
                      <Text style={s.detailValue}>Pulse MFB</Text>
                    </View>
                  </View>

                  <View style={s.rowDivider} />

                  {/* Account number row */}
                  <View style={s.detailRow}>
                    <View style={s.detailLeft}>
                      <Text style={s.detailLabel}>Account Number</Text>
                      <Text style={[s.detailValue, s.mono]}>{account.accountNumber}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.copyBtn, copied === 'number' && s.copyBtnActive]}
                      onPress={() => handleCopy('number', account.accountNumber)}
                    >
                      <Text style={[s.copyBtnText, copied === 'number' && s.copyBtnTextActive]}>
                        {copied === 'number' ? '✓ Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.rowDivider} />

                  {/* Account name row */}
                  <View style={s.detailRow}>
                    <View style={s.detailLeft}>
                      <Text style={s.detailLabel}>Account Name</Text>
                      <Text style={s.detailValue}>{account.accountName}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.copyBtn, copied === 'name' && s.copyBtnActive]}
                      onPress={() => handleCopy('name', account.accountName)}
                    >
                      <Text style={[s.copyBtnText, copied === 'name' && s.copyBtnTextActive]}>
                        {copied === 'name' ? '✓ Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rate + estimator card */}
                <View style={s.card}>
                  <View style={s.rateRow}>
                    <Text style={s.cardLabel}>Exchange Rate</Text>
                    {effectiveRate ? (
                      <Text style={s.rateValue}>
                        ₦{effectiveRate.toLocaleString('en-NG', { maximumFractionDigits: 0 })} = $1 USDC
                      </Text>
                    ) : (
                      <ActivityIndicator color="#d4a843" size="small" />
                    )}
                  </View>

                  <View style={s.estimatorWrap}>
                    <Text style={s.estimatorLabel}>How much will you send?</Text>
                    <View style={s.inputWrap}>
                      <Text style={s.inputPrefix}>₦</Text>
                      <TextInput
                        style={s.input}
                        placeholder="0"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        keyboardType="numeric"
                        value={ngnInput}
                        onChangeText={setNgnInput}
                      />
                    </View>
                    {estimatedUsdc ? (
                      <Text style={s.estimatorResult}>
                        You receive{' '}
                        <Text style={s.estimatorResultAmount}>${estimatedUsdc} USDC</Text>
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* How it works */}
                <View style={s.howCard}>
                  <View style={s.howHeader}>
                    <Info size={14} color="#d4a843" strokeWidth={1.5} />
                    <Text style={s.howTitle}>How it works</Text>
                  </View>
                  {[
                    'Copy the account details above.',
                    'Open your bank app and send any NGN amount to this account.',
                    'USDC is credited to your Cheese Pay wallet within minutes.',
                  ].map((step, i) => (
                    <View key={i} style={s.howStep}>
                      <View style={s.howStepBadge}>
                        <Text style={s.howStepNum}>{i + 1}</Text>
                      </View>
                      <Text style={s.howStepText}>{step}</Text>
                    </View>
                  ))}
                </View>

                <Text style={s.disclaimer}>
                  Deposits are converted at the rate shown above.{'\n'}
                  The rate may change between when you send and when it settles.
                </Text>
              </>
            )}
          </>
        )}

        {/* ── Crypto tab ────────────────────────────────────── */}
        {tab === 'crypto' && (
          <>
            {/* Stellar */}
            <View style={s.card}>
              <View style={s.cryptoHeader}>
                <View style={[s.cryptoIconWrap, { backgroundColor: 'rgba(74,222,128,0.1)' }]}>
                  <Zap size={18} color="#4ade80" strokeWidth={1.5} />
                </View>
                <View style={s.cryptoMeta}>
                  <Text style={s.cryptoTitle}>Stellar (USDC)</Text>
                  <Text style={s.cryptoSub}>Receive USDC directly on Stellar</Text>
                </View>
              </View>
              <Text style={s.cryptoDesc}>
                Send USDC from any Stellar wallet or exchange directly to your Cheese Pay address.
                No minimum deposit.
              </Text>
              <TouchableOpacity style={s.cryptoBtn} onPress={() => navigation.navigate('Receive')}>
                <Text style={s.cryptoBtnText}>View deposit address</Text>
                <ArrowRight size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            {/* EVM */}
            <View style={s.card}>
              <View style={s.cryptoHeader}>
                <View style={[s.cryptoIconWrap, { backgroundColor: 'rgba(167,139,250,0.1)' }]}>
                  <Hexagon size={18} color="#a78bfa" strokeWidth={1.5} />
                </View>
                <View style={s.cryptoMeta}>
                  <Text style={s.cryptoTitle}>EVM chains (USDC)</Text>
                  <Text style={s.cryptoSub}>Arbitrum, Base, Polygon & more</Text>
                </View>
              </View>
              <Text style={s.cryptoDesc}>
                Send USDC from any EVM-compatible wallet or exchange to your Cheese Pay EVM address.
              </Text>
              <TouchableOpacity style={s.cryptoBtn} onPress={() => navigation.navigate('Receive')}>
                <Text style={s.cryptoBtnText}>View deposit addresses</Text>
                <ArrowRight size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { padding: 20, paddingBottom: 40 },

  // Header
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  backBtn:   {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  title:     { fontSize: 18, fontWeight: '600', color: '#fff', letterSpacing: -0.3 },

  // Tabs
  tabBar: {
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20, alignSelf: 'center', width: '80%',
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    alignItems: 'center',
  },
  tabBtnActive:     { backgroundColor: '#d4a843' },
  tabBtnText:       { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  tabBtnTextActive: { color: '#000', fontWeight: '700' },

  // Loading / error
  loadingWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  errorWrap:   { alignItems: 'center', paddingVertical: 60, gap: 8 },
  errorTitle:  { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  errorSub:    { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },

  // Availability banner
  availBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14,
  },
  availLabel:  { fontSize: 10, color: 'rgba(34,197,94,0.7)', fontWeight: '600',
                 textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  availAmount: { fontSize: 18, fontWeight: '600', color: '#4ade80' },
  availUnit:   { fontSize: 13, fontWeight: '400', color: 'rgba(74,222,128,0.6)' },

  // Card
  card: {
    backgroundColor: '#141414', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  cardLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.4)',
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
  },
  cardBank:  { fontSize: 14, fontWeight: '600', color: '#fff', marginTop: 2 },

  // Copy button
  copyBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copyBtnActive:     { backgroundColor: 'rgba(34,197,94,0.12)' },
  copyBtnText:       { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  copyBtnTextActive: { color: '#4ade80' },

  divider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },

  // Detail rows
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  detailLeft:  { flex: 1, marginRight: 12 },
  detailLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)',
    fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2,
  },
  detailValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  mono:        { letterSpacing: 1.5 },

  // Rate + estimator
  rateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0,
  },
  rateValue: { fontSize: 13, fontWeight: '600', color: '#d4a843' },

  estimatorWrap:  { padding: 16, gap: 10 },
  estimatorLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)',
    fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 14, height: 48,
  },
  inputPrefix: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginRight: 6, fontWeight: '500' },
  input:       { flex: 1, fontSize: 14, color: '#fff', fontWeight: '500' },
  estimatorResult:       { fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'right' },
  estimatorResultAmount: { color: '#4ade80', fontWeight: '600' },

  // How it works
  howCard: {
    backgroundColor: 'rgba(212,168,67,0.04)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)',
    padding: 16, marginBottom: 14, gap: 12,
  },
  howHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  howTitle:  {
    fontSize: 11, fontWeight: '600', color: '#d4a843',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  howStep:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  howStepBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.2)',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  howStepNum:  { fontSize: 10, fontWeight: '700', color: '#d4a843' },
  howStepText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 },

  disclaimer: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)',
    textAlign: 'center', lineHeight: 17, marginTop: 4,
  },

  // Crypto tab
  cryptoHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  cryptoIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  cryptoMeta:  { flex: 1 },
  cryptoTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cryptoSub:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  cryptoDesc:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19,
                 paddingHorizontal: 16, paddingBottom: 12 },
  cryptoBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cryptoBtnText:  { fontSize: 13, fontWeight: '500', color: '#fff' },
})
