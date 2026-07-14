import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native'
import { ArrowLeft, CheckCircle } from 'lucide-react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { resolveUsername, getSendFeeRate, sendToUsername, sendToAddress, getBalance } from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { getOrCreateDeviceId, getOrCreateDeviceKeyPair, signDeviceId, hashPin } from '../../utils/crypto'
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics'
import { fmtUsdc } from '../../utils/format'
import type { Transaction } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'Send'>
type Mode = 'username' | 'address'
type Step = 1 | 2 | 3

// ── Step indicator ────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const labels = ['Recipient', 'Amount', 'Confirm']
  return (
    <View style={sb.row}>
      {labels.map((label, i) => {
        const n = (i + 1) as Step
        const active = step === n
        const done   = step > n
        return (
          <React.Fragment key={label}>
            <View style={sb.item}>
              <View style={[sb.circle, done && sb.circleDone, active && sb.circleActive]}>
                {done
                  ? <CheckCircle size={14} color="#000" strokeWidth={1.5} />
                  : <Text style={[sb.num, active && sb.numActive]}>{n}</Text>
                }
              </View>
              <Text style={[sb.label, active && sb.labelActive]}>{label}</Text>
            </View>
            {i < 2 && <View style={[sb.line, done && sb.lineDone]} />}
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────

export default function SendScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)

  // ── Step state ──
  const [step, setStep] = useState<Step>(1)

  // ── Step 1: Recipient ──
  const [mode,            setMode]            = useState<Mode>('username')
  const [recipientInput,  setRecipientInput]  = useState('')
  const [memo,            setMemo]            = useState('')
  const [resolvedName,    setResolvedName]    = useState<string | null>(null)
  const [resolving,       setResolving]       = useState(false)
  const [resolveError,    setResolveError]    = useState<string | null>(null)

  // ── Step 2: Amount ──
  const [amount,      setAmount]      = useState('')
  const [feeRate,     setFeeRate]     = useState<number>(0)
  const [feePct,      setFeePct]      = useState<string>('0%')
  const [balance,     setBalance]     = useState<string>('0')
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [amountError, setAmountError] = useState<string | null>(null)

  // ── Step 3: PIN + submit ──
  const [pin,        setPin]        = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError,setSubmitError]= useState<string | null>(null)
  const [result,     setResult]     = useState<Transaction | null>(null)
  const [biometricOk, setBiometricOk] = useState(false)

  useEffect(() => { void isBiometricAvailable().then(setBiometricOk) }, [])

  // Fetch fee rate + balance when entering step 2
  useEffect(() => {
    if (step !== 2) return
    setLoadingMeta(true)
    Promise.all([getSendFeeRate(), getBalance()])
      .then(([fee, bal]) => {
        setFeeRate(fee.feeRate)
        setFeePct(fee.feePct)
        setBalance(bal.totalUsdc)
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [step])

  // ── Derived ──
  const amountNum = parseFloat(amount) || 0
  const feeNum    = amountNum * feeRate
  const totalNum  = amountNum + feeNum
  const balanceNum= parseFloat(balance) || 0

  // ── Step 1 handlers ──

  async function handleResolveUsername() {
    const u = recipientInput.trim().replace(/^@/, '')
    if (!u) { setResolveError('Enter a username'); return }
    setResolving(true)
    setResolveError(null)
    setResolvedName(null)
    try {
      const res = await resolveUsername(u)
      setResolvedName(res.username)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Username not found'
      setResolveError(msg)
    } finally {
      setResolving(false)
    }
  }

  function handleStep1Next() {
    if (mode === 'username') {
      if (!resolvedName) { setResolveError('Verify the username first'); return }
    } else {
      if (!recipientInput.trim()) { setResolveError('Enter a wallet address'); return }
    }
    setStep(2)
  }

  // ── Step 2 handler ──

  function handleStep2Next() {
    if (!amountNum || amountNum <= 0) { setAmountError('Enter an amount'); return }
    if (totalNum > balanceNum) { setAmountError(`Insufficient balance. You have ${fmtUsdc(balance)}`); return }
    setAmountError(null)
    setStep(3)
  }

  // ── Step 3 handler ──

  async function handleBiometricSubmit() {
    const hash = await authenticateWithBiometrics()
    if (!hash) return
    await handleSubmit(hash)
  }

  async function handleSubmit(overridePinHash?: string) {
    if (!overridePinHash && pin.length !== 6) { setSubmitError('Enter your 6-digit PIN'); return }
    if (!user) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const deviceId        = await getOrCreateDeviceId()
      const { privateKey }  = await getOrCreateDeviceKeyPair()
      const deviceSignature = await signDeviceId(deviceId, privateKey)
      const pinHash         = overridePinHash ?? await hashPin(pin, user.id)
      const amountUsdc      = amountNum.toFixed(6)

      let tx: Transaction
      if (mode === 'username') {
        tx = await sendToUsername({
          username: resolvedName!,
          amountUsdc,
          pinHash,
          deviceId,
          deviceSignature,
        })
      } else {
        tx = await sendToAddress({
          address: recipientInput.trim(),
          amountUsdc,
          pinHash,
          deviceId,
          deviceSignature,
          ...(memo.trim() ? { memo: memo.trim() } : {}),
        })
      }
      setResult(tx)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Transaction failed'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──

  if (result) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <CheckCircle size={56} color="#4ade80" strokeWidth={1.5} style={{ marginBottom: 16 }} />
          <Text style={s.successTitle}>Sent!</Text>
          <Text style={s.successAmount}>{fmtUsdc(result.amountUsdc)}</Text>
          <Text style={s.successSub}>
            {mode === 'username' ? `To @${resolvedName}` : 'To address'}
          </Text>
          <View style={s.successDetails}>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Status</Text>
              <Text style={[s.detailValue, { color: result.status === 'completed' ? '#4ade80' : '#facc15' }]}>
                {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Fee</Text>
              <Text style={s.detailValue}>{fmtUsdc(result.fee)}</Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Reference</Text>
              <Text style={[s.detailValue, { fontSize: 11 }]} selectable numberOfLines={1} ellipsizeMode="middle">
                {result.reference}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <ConfettiCannon
          count={120}
          origin={{ x: Dimensions.get('window').width / 2, y: -10 }}
          fadeOut
          autoStart
          colors={['#d4a843', '#FFD700', '#FFA500', '#fff', '#34d399']}
          fallSpeed={2800}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <TouchableOpacity
            onPress={() => step === 1 ? navigation.goBack() : setStep((step - 1) as Step)}
            style={s.back}
            disabled={submitting}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ArrowLeft size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
              <Text style={s.backText}>{step === 1 ? 'Back' : 'Previous'}</Text>
            </View>
          </TouchableOpacity>
          <Text style={s.title}>Send Money</Text>
          <StepBar step={step} />

          {/* ── Step 1: Recipient ── */}
          {step === 1 && (
            <>
              <View style={s.modeRow}>
                <TouchableOpacity
                  style={[s.modeBtn, mode === 'username' && s.modeBtnActive]}
                  onPress={() => { setMode('username'); setRecipientInput(''); setResolvedName(null); setResolveError(null) }}
                >
                  <Text style={[s.modeBtnText, mode === 'username' && s.modeBtnTextActive]}>Username</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modeBtn, mode === 'address' && s.modeBtnActive]}
                  onPress={() => { setMode('address'); setRecipientInput(''); setResolvedName(null); setResolveError(null) }}
                >
                  <Text style={[s.modeBtnText, mode === 'address' && s.modeBtnTextActive]}>Address</Text>
                </TouchableOpacity>
              </View>

              {mode === 'username' ? (
                <>
                  <Text style={s.fieldLabel}>Username</Text>
                  <View style={s.inputRow}>
                    <TextInput
                      style={[s.input, s.inputFlex]}
                      placeholder="@username"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={recipientInput}
                      onChangeText={(v) => { setRecipientInput(v); setResolvedName(null); setResolveError(null) }}
                      autoCapitalize="none"
                      editable={!resolving}
                    />
                    <TouchableOpacity style={s.verifyBtn} onPress={handleResolveUsername} disabled={resolving}>
                      {resolving
                        ? <ActivityIndicator color="#000" size="small" />
                        : <Text style={s.verifyBtnText}>Verify</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {resolveError  ? <Text style={s.errorText}>{resolveError}</Text>  : null}
                  {resolvedName  ? (
                    <View style={s.resolvedCard}>
                      <CheckCircle size={14} color="#4ade80" strokeWidth={1.5} />
                      <Text style={s.resolvedText}>@{resolvedName}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={s.fieldLabel}>Wallet Address</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Stellar or EVM address"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={recipientInput}
                    onChangeText={(v) => { setRecipientInput(v); setResolveError(null) }}
                    autoCapitalize="none"
                    multiline
                  />
                  <Text style={s.fieldLabel}>Memo (optional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Memo / destination tag"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={memo}
                    onChangeText={setMemo}
                    autoCapitalize="none"
                  />
                  {resolveError ? <Text style={s.errorText}>{resolveError}</Text> : null}
                </>
              )}

              <TouchableOpacity style={s.nextBtn} onPress={handleStep1Next}>
                <Text style={s.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: Amount ── */}
          {step === 2 && (
            <>
              {loadingMeta ? (
                <View style={s.center}><ActivityIndicator color="#d4a843" /></View>
              ) : (
                <>
                  <View style={s.balanceBanner}>
                    <Text style={s.balanceBannerLabel}>Available Balance</Text>
                    <Text style={s.balanceBannerValue}>{fmtUsdc(balance)}</Text>
                  </View>

                  <Text style={s.fieldLabel}>Amount (USDC)</Text>
                  <TextInput
                    style={[s.input, s.amountInput]}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={amount}
                    onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, '')); setAmountError(null) }}
                    keyboardType="decimal-pad"
                  />

                  {amountNum > 0 && (
                    <View style={s.feeCard}>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>Amount</Text>
                        <Text style={s.feeValue}>{fmtUsdc(amountNum)}</Text>
                      </View>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>Fee ({feePct})</Text>
                        <Text style={s.feeValue}>{fmtUsdc(feeNum)}</Text>
                      </View>
                      <View style={[s.feeRow, s.feeTotalRow]}>
                        <Text style={s.feeTotalLabel}>Total deducted</Text>
                        <Text style={[s.feeTotalValue, totalNum > balanceNum && { color: '#f87171' }]}>
                          {fmtUsdc(totalNum)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {amountError ? <Text style={s.errorText}>{amountError}</Text> : null}

                  <TouchableOpacity style={s.nextBtn} onPress={handleStep2Next}>
                    <Text style={s.nextBtnText}>Next</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {/* ── Step 3: Confirm + PIN ── */}
          {step === 3 && (
            <>
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>Review Transfer</Text>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>To</Text>
                  <Text style={s.summaryValue} numberOfLines={1} ellipsizeMode="middle">
                    {mode === 'username' ? `@${resolvedName}` : recipientInput.trim()}
                  </Text>
                </View>
                {memo.trim() ? (
                  <View style={s.summaryRow}>
                    <Text style={s.summaryLabel}>Memo</Text>
                    <Text style={s.summaryValue}>{memo.trim()}</Text>
                  </View>
                ) : null}
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Amount</Text>
                  <Text style={s.summaryValue}>{fmtUsdc(amountNum)}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryLabel}>Fee ({feePct})</Text>
                  <Text style={s.summaryValue}>{fmtUsdc(feeNum)}</Text>
                </View>
                <View style={[s.summaryRow, s.summaryTotalRow]}>
                  <Text style={s.summaryTotalLabel}>Total</Text>
                  <Text style={s.summaryTotalValue}>{fmtUsdc(totalNum)}</Text>
                </View>
              </View>

              {biometricOk && (
                <TouchableOpacity style={s.biometricBtn} onPress={handleBiometricSubmit} disabled={submitting}>
                  <Text style={s.biometricText}>Use Face ID / Fingerprint</Text>
                </TouchableOpacity>
              )}
              <Text style={s.fieldLabel}>{biometricOk ? '— or enter PIN —' : 'Enter PIN'}</Text>
              <TextInput
                style={[s.input, s.pinInput]}
                placeholder="••••••"
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={pin}
                onChangeText={(v) => { setPin(v.replace(/\D/g, '')); setSubmitError(null) }}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                textAlign="center"
                editable={!submitting}
              />

              {submitError ? <Text style={s.errorText}>{submitError}</Text> : null}

              <TouchableOpacity
                style={[s.nextBtn, s.submitBtn, submitting && s.btnDisabled]}
                onPress={() => handleSubmit()}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.nextBtnText}>Send {fmtUsdc(amountNum)}</Text>
                }
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: '#0a0a0a' },
  kav:              { flex: 1 },
  container:        { flexGrow: 1, padding: 20, paddingBottom: 48 },
  back:             { marginBottom: 20 },
  backText:         { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:            { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  center:           { paddingVertical: 40, alignItems: 'center' },

  modeRow:          { flexDirection: 'row', gap: 10, marginBottom: 24 },
  modeBtn:          {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#141414', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  modeBtnActive:    { backgroundColor: '#d4a843', borderColor: '#d4a843' },
  modeBtnText:      { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  modeBtnTextActive:{ color: '#000' },

  fieldLabel:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  inputRow:         { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputFlex:        { flex: 1, marginBottom: 0 },
  input:            {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 16,
  },
  amountInput:      { fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  pinInput:         { fontSize: 24, letterSpacing: 12 },
  biometricBtn:     {
    backgroundColor: 'rgba(212,168,67,0.1)', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)',
  },
  biometricText:    { color: '#d4a843', fontWeight: '600', fontSize: 14 },

  verifyBtn:        {
    backgroundColor: '#d4a843', borderRadius: 14, paddingHorizontal: 18,
    justifyContent: 'center', minWidth: 80, alignItems: 'center',
  },
  verifyBtnText:    { color: '#000', fontWeight: '700', fontSize: 14 },

  resolvedCard:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  resolvedText:     { color: '#4ade80', fontWeight: '600', fontSize: 14 },

  errorText:        { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },

  balanceBanner:    {
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  balanceBannerLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  balanceBannerValue:{ fontSize: 20, fontWeight: '700', color: '#fff' },

  feeCard:          {
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  feeRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  feeLabel:         { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  feeValue:         { fontSize: 13, color: '#fff' },
  feeTotalRow:      {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 6, paddingTop: 12,
  },
  feeTotalLabel:    { fontSize: 14, fontWeight: '600', color: '#fff' },
  feeTotalValue:    { fontSize: 14, fontWeight: '700', color: '#fff' },

  summaryCard:      {
    backgroundColor: '#141414', borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryTitle:     { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 },
  summaryRow:       {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel:     { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  summaryValue:     { fontSize: 13, color: '#fff', fontWeight: '500', flex: 2, textAlign: 'right' },
  summaryTotalRow:  { borderBottomWidth: 0, marginTop: 4 },
  summaryTotalLabel:{ fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },
  summaryTotalValue:{ fontSize: 15, fontWeight: '700', color: '#d4a843', flex: 2, textAlign: 'right' },

  nextBtn:          {
    backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center',
  },
  submitBtn:        { marginTop: 16 },
  btnDisabled:      { opacity: 0.6 },
  nextBtnText:      { color: '#000', fontWeight: '700', fontSize: 15 },

  successWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle:     { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  successAmount:    { fontSize: 36, fontWeight: '700', color: '#4ade80', marginBottom: 4, letterSpacing: -1 },
  successSub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 },
  successDetails:   {
    backgroundColor: '#141414', borderRadius: 16, padding: 20, width: '100%', marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  detailRow:        {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel:      { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  detailValue:      { fontSize: 13, color: '#fff', fontWeight: '500' },
  doneBtn:          {
    backgroundColor: '#d4a843', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 48, alignItems: 'center',
  },
  doneBtnText:      { color: '#000', fontWeight: '700', fontSize: 16 },
})

const sb = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  item:        { alignItems: 'center' },
  circle:      {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#141414', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  circleActive:{ backgroundColor: '#d4a843', borderColor: '#d4a843' },
  circleDone:  { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  num:         { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  numActive:   { color: '#000' },
  label:       { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '500' },
  labelActive: { color: '#fff' },
  line:        { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 6, marginBottom: 18 },
  lineDone:    { backgroundColor: '#4ade80' },
})
