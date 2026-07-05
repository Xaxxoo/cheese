import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, ActivityIndicator, Modal, useWindowDimensions,
} from 'react-native'
import { ArrowLeft, Snowflake, CheckCircle, Copy, Eye, EyeOff, Lock, CreditCard } from 'lucide-react-native'
import * as Clipboard from 'expo-clipboard'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import {
  getCard, freezeCard, unfreezeCard, revealCvv, getCardTransactions,
} from '../../api/wallet'
import PinPad from '../../components/PinPad'
import type { VirtualCard, Transaction } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Card'>

// ── Mastercard logo ───────────────────────────────────────

function MastercardLogo() {
  return (
    <View style={{ width: 42, height: 26, position: 'relative' }}>
      <View style={[mc.circle, { backgroundColor: 'rgba(239,68,68,0.9)', left: 0 }]} />
      <View style={[mc.circle, { backgroundColor: 'rgba(251,191,36,0.9)', left: 14 }]} />
    </View>
  )
}

const mc = StyleSheet.create({
  circle: { position: 'absolute', width: 26, height: 26, borderRadius: 13, top: 0 },
})

// ── Card visual ───────────────────────────────────────────

function CardVisual({ card, cardWidth }: { card: VirtualCard; cardWidth: number }) {
  const cardHeight = cardWidth / 1.586
  const isFrozen   = card.status === 'frozen'

  return (
    <View style={[
      cv.card,
      {
        width: cardWidth, height: cardHeight,
        backgroundColor: isFrozen ? '#0f1824' : '#131000',
        borderColor: isFrozen ? 'rgba(96,165,250,0.25)' : 'rgba(212,168,67,0.25)',
      },
    ]}>
      {/* EMV chip */}
      <View style={[
        cv.chip,
        {
          backgroundColor: isFrozen ? '#1e293b' : '#8b6914',
          borderColor: isFrozen ? 'rgba(96,165,250,0.2)' : 'rgba(212,168,67,0.35)',
        },
      ]} />

      {/* Frozen overlay */}
      {isFrozen && (
        <View style={cv.frozenOverlay}>
          <Snowflake size={28} color="rgba(96,165,250,0.65)" strokeWidth={1.5} />
          <Text style={cv.frozenLabel}>FROZEN</Text>
        </View>
      )}

      {/* Top row: brand + network */}
      <View style={cv.topRow}>
        <Text style={[cv.brandText, { color: isFrozen ? 'rgba(148,163,184,0.6)' : 'rgba(212,168,67,0.7)' }]}>
          Cheese Pay
        </Text>
        <MastercardLogo />
      </View>

      {/* Masked number */}
      <Text style={cv.number}>{card.maskedNumber}</Text>

      {/* Bottom row: holder + expiry */}
      <View style={cv.bottomRow}>
        <View>
          <Text style={cv.metaLabel}>Card Holder</Text>
          <Text style={cv.metaValue}>{card.holderName}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={cv.metaLabel}>Expires</Text>
          <Text style={cv.metaValue}>{card.expiry}</Text>
        </View>
      </View>
    </View>
  )
}

const cv = StyleSheet.create({
  card: {
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1,
  },
  chip: {
    position: 'absolute', top: '28%', left: '6%',
    width: '13%', aspectRatio: 1.4, borderRadius: 4,
    borderWidth: 1,
  },
  frozenOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(15,24,36,0.35)', gap: 6,
  },
  frozenLabel: {
    fontSize: 11, color: 'rgba(147,197,253,0.7)',
    fontWeight: '600', letterSpacing: 4,
  },
  topRow: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 16,
  },
  brandText: { fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  number: {
    position: 'absolute', left: 18, right: 18, bottom: '38%',
    fontSize: 15, letterSpacing: 3, color: 'rgba(255,255,255,0.82)',
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 18, paddingBottom: 16,
  },
  metaLabel: {
    fontSize: 8, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3,
  },
  metaValue: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.82)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
})

// ── CVV modal ─────────────────────────────────────────────

function CvvModal({ onClose }: { onClose: () => void }) {
  const [pin,        setPin]        = useState('')
  const [cvv,        setCvv]        = useState<string | null>(null)
  const [cvvVisible, setCvvVisible] = useState(false)
  const [countdown,  setCountdown]  = useState(60)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  // Auto-submit at 6 digits
  useEffect(() => {
    if (pin.length === 6 && !submitting && !cvv) void submit(pin)
  }, [pin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown once CVV is revealed
  useEffect(() => {
    if (!cvv) return
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(id); onClose(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [cvv, onClose])

  async function submit(rawPin: string) {
    setSubmitting(true)
    setError('')
    try {
      const result = await revealCvv(rawPin)
      setCvv(result.cvv)
      setCountdown(60)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Incorrect PIN. Try again.'
      setError(msg)
      setPin('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={cm.handle} />

          {!cvv ? (
            <View style={cm.pinSection}>
              <Text style={cm.title}>Enter your PIN</Text>
              <Text style={cm.sub}>Required to reveal your CVV</Text>
              {!!error && <Text style={cm.error}>{error}</Text>}
              {submitting
                ? <ActivityIndicator color="#d4a843" style={{ marginVertical: 32 }} />
                : <PinPad value={pin} onChange={setPin} />
              }
            </View>
          ) : (
            <View style={cm.cvvSection}>
              <Text style={cm.title}>Your CVV</Text>
              <Text style={cm.sub}>Hides in {countdown}s</Text>

              <View style={cm.cvvBox}>
                <Text style={cm.cvvValue}>{cvvVisible ? cvv : '•••'}</Text>
                <TouchableOpacity
                  style={cm.eyeBtn}
                  onPress={() => setCvvVisible((v) => !v)}
                >
                  {cvvVisible
                    ? <EyeOff size={18} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
                    : <Eye size={18} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
                  }
                </TouchableOpacity>
              </View>

              <View style={cm.countdownRow}>
                <View style={[cm.countdownDot, { backgroundColor: countdown > 15 ? '#4ade80' : '#f87171' }]} />
                <Text style={cm.countdownText}>Auto-hides in {countdown} seconds</Text>
              </View>

              <TouchableOpacity style={cm.doneBtn} onPress={onClose}>
                <Text style={cm.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const cm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  pinSection: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8, gap: 6 },
  cvvSection: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8,
    alignItems: 'center', gap: 16,
  },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center' },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  error: { fontSize: 13, color: '#f87171', textAlign: 'center' },

  cvvBox: {
    width: '100%', borderRadius: 18,
    backgroundColor: 'rgba(212,168,67,0.06)',
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.15)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 20,
  },
  cvvValue:     { fontSize: 38, fontWeight: '700', letterSpacing: 8, color: '#d4a843' },
  eyeBtn:       {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownDot: { width: 8, height: 8, borderRadius: 4 },
  countdownText:{ fontSize: 12, color: 'rgba(255,255,255,0.3)' },

  doneBtn:     {
    width: '100%', height: 44, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
})

// ── Screen ────────────────────────────────────────────────

export default function CardScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions()
  const cardWidth = screenWidth - 40   // 20px padding each side

  const [card,         setCard]         = useState<VirtualCard | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [lockMsg,      setLockMsg]      = useState<string | null>(null)
  const [showCvv,      setShowCvv]      = useState(false)
  const [freezeLoading,setFreezeLoading]= useState(false)
  const [copiedNum,    setCopiedNum]    = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getCard(), getCardTransactions()])
      .then(([c, txs]) => {
        setCard(c)
        setTransactions(txs.filter((tx) => tx.type === 'card_payment'))
        setError(null)
      })
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (e as Error)?.message
          ?? 'Could not load card'
        setError(msg)
        setLockMsg(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  async function toggleFreeze() {
    if (!card || freezeLoading) return
    setFreezeLoading(true)
    try {
      const updated = card.status === 'frozen' ? await unfreezeCard() : await freezeCard()
      setCard(updated)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not update card'
      setError(msg)
    } finally {
      setFreezeLoading(false)
    }
  }

  async function copyNumber() {
    if (!card) return
    await Clipboard.setStringAsync(card.maskedNumber)
    setCopiedNum(true)
    setTimeout(() => setCopiedNum(false), 2000)
  }

  const handleCloseCvv = useCallback(() => setShowCvv(false), [])

  const isFrozen = card?.status === 'frozen'

  const spendPct = card
    ? Math.min(100, (parseFloat(card.monthlySpend) / parseFloat(card.spendLimit)) * 100)
    : 0

  const spendBarColor =
    spendPct > 80 ? '#f87171' : spendPct > 50 ? '#fbbf24' : '#d4a843'

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
          </TouchableOpacity>
          <Text style={s.title}>My Card</Text>
          {card && (
            <View style={[s.statusBadge, isFrozen ? s.statusFrozen : s.statusActive]}>
              {isFrozen
                ? <Snowflake size={12} color="#93c5fd" strokeWidth={1.5} />
                : <CheckCircle size={12} color="#4ade80" strokeWidth={1.5} />
              }
              <Text style={[s.statusText, { color: isFrozen ? '#93c5fd' : '#4ade80' }]}>
                {isFrozen ? 'Frozen' : 'Active'}
              </Text>
            </View>
          )}
        </View>

        {/* Loading skeleton */}
        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color="#d4a843" size="large" />
          </View>
        )}

        {/* Locked / error */}
        {!loading && !card && lockMsg && (
          <View style={s.lockedWrap}>
            <Lock size={44} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
            <Text style={s.lockedTitle}>Card Locked</Text>
            <Text style={s.lockedSub}>{lockMsg}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('KYC')}>
              <Text style={s.lockedLink}>Complete verification →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Card loaded */}
        {card && (
          <>
            {/* Card visual */}
            <CardVisual card={card} cardWidth={cardWidth} />

            {/* Action buttons */}
            <View style={s.actions}>
              {/* Freeze / Unfreeze */}
              <TouchableOpacity
                style={[s.actionBtn, isFrozen && s.actionBtnBlue]}
                onPress={toggleFreeze}
                disabled={freezeLoading}
              >
                {freezeLoading
                  ? <ActivityIndicator color={isFrozen ? '#93c5fd' : 'rgba(255,255,255,0.6)'} size="small" />
                  : <Snowflake size={22} color={isFrozen ? '#93c5fd' : 'rgba(255,255,255,0.6)'} strokeWidth={1.5} />
                }
                <Text style={[s.actionLabel, isFrozen && { color: '#93c5fd' }]}>
                  {isFrozen ? 'Unfreeze' : 'Freeze'}
                </Text>
              </TouchableOpacity>

              {/* Copy number */}
              <TouchableOpacity style={s.actionBtn} onPress={copyNumber}>
                {copiedNum
                  ? <CheckCircle size={22} color="#4ade80" strokeWidth={1.5} />
                  : <Copy size={22} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
                }
                <Text style={[s.actionLabel, copiedNum && { color: '#4ade80' }]}>
                  {copiedNum ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>

              {/* Reveal CVV */}
              <TouchableOpacity
                style={[s.actionBtn, isFrozen && s.actionBtnDisabled]}
                onPress={() => !isFrozen && setShowCvv(true)}
                disabled={isFrozen}
              >
                <Eye size={22} color={isFrozen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)'} strokeWidth={1.5} />
                <Text style={[s.actionLabel, isFrozen && s.labelDim]}>CVV</Text>
              </TouchableOpacity>
            </View>

            {/* Stats card */}
            <View style={s.statsCard}>
              {/* Three stat cells */}
              <View style={s.statRow}>
                {[
                  { label: 'Balance', value: `$${parseFloat(card.availableBalance).toFixed(2)}`, color: '#4ade80' },
                  { label: 'Spent',   value: `$${parseFloat(card.monthlySpend).toFixed(2)}`,    color: '#fff'    },
                  { label: 'Limit',   value: `$${parseFloat(card.spendLimit).toFixed(0)}`,      color: '#d4a843' },
                ].map(({ label, value, color }) => (
                  <View key={label} style={s.statCell}>
                    <Text style={[s.statValue, { color }]}>{value}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Spend bar */}
              <View style={s.spendBarSection}>
                <View style={s.spendBarHeader}>
                  <Text style={s.spendBarLabel}>Monthly spend</Text>
                  <Text style={s.spendBarPct}>{spendPct.toFixed(0)}% of limit</Text>
                </View>
                <View style={s.spendBarTrack}>
                  <View style={[s.spendBarFill, { width: `${spendPct}%`, backgroundColor: spendBarColor }]} />
                </View>
              </View>
            </View>

            {/* Transactions */}
            <View style={s.txSection}>
              <Text style={s.txSectionLabel}>Card transactions</Text>

              {transactions.length === 0 ? (
                <View style={s.emptyCard}>
                  <CreditCard size={26} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
                  <Text style={s.emptyText}>No card transactions yet</Text>
                </View>
              ) : (
                <View style={s.txList}>
                  {transactions.map((tx) => (
                    <View key={tx.id} style={s.txRow}>
                      <View style={s.txIconWrap}>
                        <CreditCard size={18} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
                      </View>
                      <View style={s.txMeta}>
                        <Text style={s.txLabel} numberOfLines={1}>
                          {tx.description ?? 'Card Payment'}
                        </Text>
                        <Text style={s.txDate}>
                          {new Date(tx.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(tx.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={s.txAmount}>-${parseFloat(tx.amountUsdc).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

      </ScrollView>

      {showCvv && <CvvModal onClose={handleCloseCvv} />}
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
  title:       { fontSize: 18, fontWeight: '600', color: '#fff', letterSpacing: -0.3, flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusActive: { backgroundColor: 'rgba(74,222,128,0.12)' },
  statusFrozen: { backgroundColor: 'rgba(147,197,253,0.12)' },
  statusText:   { fontSize: 12, fontWeight: '600' },

  loadingWrap: { paddingVertical: 80, alignItems: 'center' },

  lockedWrap:  {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 10,
  },
  lockedTitle: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  lockedSub:   {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', lineHeight: 19, maxWidth: 260,
  },
  lockedLink:  { fontSize: 13, color: '#d4a843', marginTop: 4 },

  // Action buttons
  actions:       { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 4 },
  actionBtn:     {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 6,
  },
  actionBtnBlue: {
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderColor: 'rgba(96,165,250,0.2)',
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  labelDim:    { opacity: 0.4 },

  // Stats card
  statsCard: {
    backgroundColor: '#141414', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 14, padding: 16, gap: 16,
  },
  statRow:   { flexDirection: 'row', gap: 8 },
  statCell:  {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: '700' },
  statLabel: {
    fontSize: 9, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },

  spendBarSection: { gap: 8 },
  spendBarHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  spendBarLabel:   {
    fontSize: 10, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },
  spendBarPct:     { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  spendBarTrack:   {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3, overflow: 'hidden',
  },
  spendBarFill: { height: '100%', borderRadius: 3 },

  // Transactions
  txSection:      { marginTop: 20 },
  txSectionLabel: {
    fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#141414', borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },

  txList:    { gap: 6 },
  txRow:     {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#141414', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12,
  },
  txIconWrap:{ width: 38, height: 38, borderRadius: 12,
               backgroundColor: 'rgba(255,255,255,0.06)',
               alignItems: 'center', justifyContent: 'center' },
  txMeta:    { flex: 1 },
  txLabel:   { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 2 },
  txDate:    { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  txAmount:  { fontSize: 14, fontWeight: '600', color: '#fff' },
})
