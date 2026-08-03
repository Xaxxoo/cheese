import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Modal, FlatList, Dimensions,
} from 'react-native'
import ConfettiCannon from 'react-native-confetti-cannon'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import {
  getBanks, resolveAccount, bankTransfer,
  getExchangeRate, getBalance,
} from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { getOrCreateDeviceId, getOrCreateDeviceKeyPair, signDeviceId, hashPin } from '../../utils/crypto'
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics'
import { fmtUsdc, fmtNgn } from '../../utils/format'
import type { NigerianBank, AccountResolveResponse, BankTransferResponse } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'BankTransfer'>
type Step = 1 | 2 | 3

// ── Step bar ──────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const labels = ['Account', 'Amount', 'Confirm']
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
                <Text style={[sb.num, (done || active) && sb.numActive]}>{done ? '✓' : n}</Text>
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

// ── Bank picker modal ─────────────────────────────────────

function BankPickerModal({
  banks, onSelect, onClose,
}: {
  banks: NigerianBank[]
  onSelect: (bank: NigerianBank) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => banks.filter((b) => b.name.toLowerCase().includes(query.toLowerCase())),
    [banks, query],
  )
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bp.overlay}>
        <View style={bp.sheet}>
          <View style={bp.handle} />
          <Text style={bp.title}>Select Bank</Text>
          <TextInput
            style={bp.search}
            placeholder="Search banks..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={bp.bankRow} onPress={() => onSelect(item)}>
                <Text style={bp.bankName}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={bp.sep} />}
            keyboardShouldPersistTaps="handled"
          />
          <TouchableOpacity style={bp.cancelBtn} onPress={onClose}>
            <Text style={bp.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────

export default function BankTransferScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)

  const [step, setStep] = useState<Step>(1)

  // ── Step 1: Bank + account ──
  const [banks,        setBanks]        = useState<NigerianBank[]>([])
  const [banksLoading, setBanksLoading] = useState(true)
  const [pickerOpen,   setPickerOpen]   = useState(false)
  const [selectedBank, setSelectedBank] = useState<NigerianBank | null>(null)
  const [accountNo,    setAccountNo]    = useState('')
  const [resolved,     setResolved]     = useState<AccountResolveResponse | null>(null)
  const [resolving,    setResolving]    = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  // ── Step 2: Amount ──
  const [amountNgn,    setAmountNgn]    = useState('')
  const [narration,    setNarration]    = useState('')
  const [rate,         setRate]         = useState<number>(0)
  const [balance,      setBalance]      = useState<string>('0')
  const [loadingMeta,  setLoadingMeta]  = useState(false)
  const [amountError,  setAmountError]  = useState<string | null>(null)

  // ── Step 3: PIN + submit ──
  const [pin,         setPin]         = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result,      setResult]      = useState<BankTransferResponse | null>(null)
  const [biometricOk, setBiometricOk] = useState(false)

  useEffect(() => { void isBiometricAvailable().then(setBiometricOk) }, [])

  // Load banks on mount
  useEffect(() => {
    getBanks()
      .then(setBanks)
      .catch(() => {})
      .finally(() => setBanksLoading(false))
  }, [])

  // Load rate + balance on entering step 2
  useEffect(() => {
    if (step !== 2) return
    setLoadingMeta(true)
    Promise.all([getExchangeRate(), getBalance()])
      .then(([r, bal]) => {
        setRate(parseFloat(r.effectiveRate))
        setBalance(bal.totalUsdc)
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [step])

  // ── Derived ──
  const amountNum  = parseFloat(amountNgn.replace(/,/g, '')) || 0
  const balanceNum = parseFloat(balance) || 0

  function computeFeeUsdc(ngn: number, r: number): number {
    if (r <= 0) return 0
    if (ngn < 10_000) return 50 / r
    if (ngn <= 50_000) return 200 / r
    if (ngn < 100_000) return 500 / r
    if (ngn < 500_000) return 1_000 / r
    return 1_300 / r
  }

  const feeUsdc    = computeFeeUsdc(amountNum, rate)
  const usdcNeeded = rate > 0 ? amountNum / rate : 0
  const totalUsdc  = usdcNeeded + feeUsdc

  // ── Step 1 handlers ──

  async function handleResolve() {
    if (!selectedBank) { setResolveError('Select a bank first'); return }
    if (accountNo.length !== 10) { setResolveError('Account number must be 10 digits'); return }
    setResolving(true)
    setResolveError(null)
    setResolved(null)
    try {
      const res = await resolveAccount({ bankCode: selectedBank.code, accountNumber: accountNo })
      setResolved(res)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Account not found'
      setResolveError(msg)
    } finally {
      setResolving(false)
    }
  }

  function handleStep1Next() {
    if (!selectedBank)  { setResolveError('Select a bank');           return }
    if (!resolved)      { setResolveError('Verify the account first'); return }
    setStep(2)
  }

  // ── Step 2 handler ──

  function handleStep2Next() {
    if (!amountNum || amountNum <= 0) { setAmountError('Enter an amount');            return }
    if (totalUsdc > balanceNum)       { setAmountError(`Insufficient balance. You have ${fmtUsdc(balance)}`); return }
    setAmountError(null)
    setStep(3)
  }

  // ── Step 3 handlers ──

  async function handleBiometricSubmit() {
    const hash = await authenticateWithBiometrics()
    if (!hash) return
    await handleSubmit(hash)
  }

  async function handleSubmit(overridePinHash?: string) {
    if (!overridePinHash && pin.length !== 6) { setSubmitError('Enter your 6-digit PIN'); return }
    if (!user || !selectedBank || !resolved) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const deviceId        = await getOrCreateDeviceId()
      const { privateKey }  = await getOrCreateDeviceKeyPair()
      const deviceSignature = await signDeviceId(deviceId, privateKey)
      const pinHash         = overridePinHash ?? await hashPin(pin, user.id)
      const timestamp       = new Date().toISOString()
      const nonce           = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      const res = await bankTransfer({
        bankCode:     selectedBank.code,
        accountNumber: resolved.accountNumber,
        accountName:  resolved.accountName,
        amountNgn:    amountNum.toFixed(2),
        narration:    narration.trim() || undefined,
        pinHash,
        deviceSignature,
        deviceId,
        timestamp,
        nonce,
      })
      setResult(res)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Transfer failed'
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
          <Text style={s.successIcon}>🏦</Text>
          <Text style={s.successTitle}>Transfer Initiated</Text>
          <Text style={s.successAmount}>{fmtNgn(result.amountNgn)}</Text>
          <Text style={s.successSub}>To {result.recipientName} · {result.bankName}</Text>

          <View style={s.successDetails}>
            {[
              { label: 'Status',     value: result.status.charAt(0).toUpperCase() + result.status.slice(1),
                color: result.status === 'completed' ? '#4ade80' : '#facc15' },
              { label: 'USDC Debited', value: fmtUsdc(result.amountUsdc) },
              { label: 'Fee',          value: fmtUsdc(result.fee) },
              { label: 'Rate',         value: `₦${result.rateApplied}` },
              { label: 'Reference',    value: result.reference },
            ].map(({ label, value, color }) => (
              <View key={label} style={s.detailRow}>
                <Text style={s.detailLabel}>{label}</Text>
                <Text style={[s.detailValue, color ? { color } : null]} selectable numberOfLines={1} ellipsizeMode="middle">
                  {value}
                </Text>
              </View>
            ))}
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

          <TouchableOpacity
            onPress={() => step === 1 ? navigation.goBack() : setStep((step - 1) as Step)}
            style={s.back} disabled={submitting}
          >
            <Text style={s.backText}>← {step === 1 ? 'Back' : 'Previous'}</Text>
          </TouchableOpacity>
          <Text style={s.title}>Bank Transfer</Text>
          <StepBar step={step} />

          {/* ── Step 1: Bank + Account ── */}
          {step === 1 && (
            <>
              <Text style={s.fieldLabel}>Bank</Text>
              {banksLoading ? (
                <ActivityIndicator color="#d4a843" style={{ marginBottom: 16 }} />
              ) : (
                <TouchableOpacity style={s.bankSelector} onPress={() => setPickerOpen(true)}>
                  <Text style={selectedBank ? s.bankSelectorText : s.bankSelectorPlaceholder}>
                    {selectedBank ? selectedBank.name : 'Select bank'}
                  </Text>
                  <Text style={s.chevron}>›</Text>
                </TouchableOpacity>
              )}

              <Text style={s.fieldLabel}>Account Number</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, s.inputFlex]}
                  placeholder="10-digit account number"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={accountNo}
                  onChangeText={(v) => { setAccountNo(v.replace(/\D/g, '').slice(0, 10)); setResolved(null); setResolveError(null) }}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!resolving}
                />
                <TouchableOpacity style={s.verifyBtn} onPress={handleResolve} disabled={resolving}>
                  {resolving
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={s.verifyBtnText}>Verify</Text>
                  }
                </TouchableOpacity>
              </View>

              {resolveError ? <Text style={s.errorText}>{resolveError}</Text> : null}

              {resolved ? (
                <View style={s.resolvedCard}>
                  <Text style={s.resolvedIcon}>✓</Text>
                  <View>
                    <Text style={s.resolvedName}>{resolved.accountName}</Text>
                    <Text style={s.resolvedBank}>{resolved.bankName}</Text>
                  </View>
                </View>
              ) : null}

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

                  <Text style={s.fieldLabel}>Amount (NGN)</Text>
                  <TextInput
                    style={[s.input, s.amountInput]}
                    placeholder="0.00"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={amountNgn}
                    onChangeText={(v) => { setAmountNgn(v.replace(/[^0-9.]/g, '')); setAmountError(null) }}
                    keyboardType="decimal-pad"
                  />

                  {amountNum > 0 && rate > 0 && (
                    <View style={s.feeCard}>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>NGN Amount</Text>
                        <Text style={s.feeValue}>{fmtNgn(amountNum)}</Text>
                      </View>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>Rate</Text>
                        <Text style={s.feeValue}>₦{rate.toFixed(2)} / USDC</Text>
                      </View>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>Transfer Fee</Text>
                        <Text style={s.feeValue}>{fmtUsdc(feeUsdc)}</Text>
                      </View>
                      <View style={[s.feeRow, s.feeTotalRow]}>
                        <Text style={s.feeTotalLabel}>Est. USDC deducted</Text>
                        <Text style={[s.feeTotalValue, totalUsdc > balanceNum && { color: '#f87171' }]}>
                          ~{fmtUsdc(totalUsdc)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text style={s.fieldLabel}>Narration (optional)</Text>
                  <TextInput
                    style={s.input}
                    placeholder="Payment description"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={narration}
                    onChangeText={setNarration}
                    maxLength={100}
                  />

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
                {[
                  { label: 'To',          value: resolved?.accountName ?? '' },
                  { label: 'Bank',        value: selectedBank?.name ?? '' },
                  { label: 'Account No.', value: resolved?.accountNumber ?? '' },
                  { label: 'Amount',      value: fmtNgn(amountNum) },
                  { label: 'Fee',         value: fmtUsdc(feeUsdc) },
                  { label: 'Est. USDC',   value: `~${fmtUsdc(totalUsdc)}` },
                  ...(narration.trim() ? [{ label: 'Narration', value: narration.trim() }] : []),
                ].map(({ label, value }) => (
                  <View key={label} style={s.summaryRow}>
                    <Text style={s.summaryLabel}>{label}</Text>
                    <Text style={s.summaryValue} numberOfLines={1}>{value}</Text>
                  </View>
                ))}
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
                style={[s.nextBtn, submitting && s.btnDisabled]}
                onPress={() => handleSubmit()}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.nextBtnText}>Send {fmtNgn(amountNum)}</Text>
                }
              </TouchableOpacity>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {pickerOpen && (
        <BankPickerModal
          banks={banks}
          onSelect={(bank) => { setSelectedBank(bank); setPickerOpen(false); setResolved(null); setAccountNo(''); setResolveError(null) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#0a0a0a' },
  kav:               { flex: 1 },
  container:         { flexGrow: 1, padding: 20, paddingBottom: 48 },
  back:              { marginBottom: 20 },
  backText:          { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:             { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  center:            { paddingVertical: 40, alignItems: 'center' },

  fieldLabel:        { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                       textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

  bankSelector:      {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, marginBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  bankSelectorText:  { color: '#fff', fontSize: 15 },
  bankSelectorPlaceholder: { color: 'rgba(255,255,255,0.2)', fontSize: 15 },
  chevron:           { color: 'rgba(255,255,255,0.3)', fontSize: 20 },

  inputRow:          { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputFlex:         { flex: 1, marginBottom: 0 },
  input:             {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 16,
  },
  amountInput:       { fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  pinInput:          { fontSize: 24, letterSpacing: 12 },

  verifyBtn:         {
    backgroundColor: '#d4a843', borderRadius: 14, paddingHorizontal: 18,
    justifyContent: 'center', minWidth: 80, alignItems: 'center',
  },
  verifyBtnText:     { color: '#000', fontWeight: '700', fontSize: 14 },

  resolvedCard:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  resolvedIcon:      { color: '#4ade80', fontSize: 18 },
  resolvedName:      { color: '#4ade80', fontWeight: '700', fontSize: 15 },
  resolvedBank:      { color: 'rgba(74,222,128,0.6)', fontSize: 12, marginTop: 2 },

  errorText:         { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },

  balanceBanner:     {
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  balanceBannerLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  balanceBannerValue:{ fontSize: 20, fontWeight: '700', color: '#fff' },

  feeCard:           {
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  feeRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  feeLabel:          { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  feeValue:          { fontSize: 13, color: '#fff' },
  feeTotalRow:       {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 6, paddingTop: 12,
  },
  feeTotalLabel:     { fontSize: 14, fontWeight: '600', color: '#fff' },
  feeTotalValue:     { fontSize: 14, fontWeight: '700', color: '#fff' },

  summaryCard:       {
    backgroundColor: '#141414', borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  summaryTitle:      { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                       textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 },
  summaryRow:        {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel:      { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  summaryValue:      { fontSize: 13, color: '#fff', fontWeight: '500', flex: 2, textAlign: 'right' },

  nextBtn:           {
    backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center',
  },
  btnDisabled:       { opacity: 0.6 },
  nextBtnText:       { color: '#000', fontWeight: '700', fontSize: 15 },
  biometricBtn:      {
    backgroundColor: 'rgba(212,168,67,0.1)', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)',
  },
  biometricText:     { color: '#d4a843', fontWeight: '600', fontSize: 14 },

  successWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon:       { fontSize: 56, marginBottom: 16 },
  successTitle:      { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  successAmount:     { fontSize: 36, fontWeight: '700', color: '#4ade80', marginBottom: 4, letterSpacing: -1 },
  successSub:        { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32, textAlign: 'center' },
  successDetails:    {
    backgroundColor: '#141414', borderRadius: 16, padding: 20, width: '100%', marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  detailRow:         {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailLabel:       { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  detailValue:       { fontSize: 13, color: '#fff', fontWeight: '500', flex: 2, textAlign: 'right' },
  doneBtn:           {
    backgroundColor: '#d4a843', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 48, alignItems: 'center',
  },
  doneBtnText:       { color: '#000', fontWeight: '700', fontSize: 16 },
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

const bp = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:     {
    backgroundColor: '#141414', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40, maxHeight: '80%',
  },
  handle:    {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16,
  },
  title:     { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 14 },
  search:    {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 12, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  bankRow:   { paddingVertical: 14, paddingHorizontal: 4 },
  bankName:  { fontSize: 15, color: '#fff' },
  sep:       { height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelBtn: {
    marginTop: 16, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  cancelText:{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', fontSize: 15 },
})
