import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native'
import { getBillers, getBillVariations, verifyBillCustomer, payBill } from '../../api/bills'
import type { Biller } from '../../api/bills'
import { getExchangeRate, getBalance } from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { getOrCreateDeviceId, getOrCreateDeviceKeyPair, signDeviceId, hashPin } from '../../utils/crypto'
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics'
import { fmtUsdc, fmtNgn } from '../../utils/format'
import type { BillVariation, PayBillResponse } from '../../types'

// ── Config type ───────────────────────────────────────────

export interface BillProvider {
  id: string
  name: string
  icon: string
}

export interface BillFlowConfig {
  title: string
  providers?: BillProvider[]
  category?: string
  billersCodeLabel: string
  billersCodePlaceholder: string
  billersCodeKeyboard: 'number-pad' | 'phone-pad' | 'default'
  needsVerify: boolean       // TV, Electricity
  hasVariations: boolean     // Data, TV
  hasCustomAmount: boolean   // Airtime, Electricity
  resultHasToken?: boolean   // Electricity
}

interface Props {
  config: BillFlowConfig
  onBack: () => void
}

type Step = 1 | 2 | 3

// ── Step bar ──────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const labels = ['Provider', 'Plan', 'Confirm']
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

// ── Main component ────────────────────────────────────────

export default function BillPayFlow({ config, onBack }: Props) {
  const user = useAuthStore((s) => s.user)

  const [step, setStep] = useState<Step>(1)

  // ── Dynamic billers ──
  const [dynamicProviders, setDynamicProviders] = useState<BillProvider[]>(config.providers ?? [])
  const [loadingBillers, setLoadingBillers]     = useState(!config.providers)

  useEffect(() => {
    if (config.providers || !config.category) return
    setLoadingBillers(true)
    getBillers(config.category)
      .then((billers: Biller[]) => {
        setDynamicProviders(
          billers.map((b) => ({
            id: b.biller_code,
            name: b.name || b.biller_name || b.short_name,
            icon: config.category === 'electricity' ? '⚡' : config.category === 'tv' ? '📺' : '📱',
          })),
        )
      })
      .catch(() => {})
      .finally(() => setLoadingBillers(false))
  }, [config.providers, config.category])

  // ── Step 1 ──
  const [provider,     setProvider]     = useState<BillProvider | null>(null)
  const [billersCode,  setBillersCode]  = useState('')
  const [verified,     setVerified]     = useState<string | null>(null) // customer name
  const [verifying,    setVerifying]    = useState(false)
  const [verifyError,  setVerifyError]  = useState<string | null>(null)
  const [step1Error,   setStep1Error]   = useState<string | null>(null)

  // ── Step 2 ──
  const [variations,   setVariations]   = useState<BillVariation[]>([])
  const [loadingVars,  setLoadingVars]  = useState(false)
  const [selectedVar,  setSelectedVar]  = useState<BillVariation | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [rate,         setRate]         = useState<number>(0)
  const [balance,      setBalance]      = useState<string>('0')
  const [loadingMeta,  setLoadingMeta]  = useState(false)
  const [step2Error,   setStep2Error]   = useState<string | null>(null)

  // ── Step 3 ──
  const [pin,         setPin]         = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result,      setResult]      = useState<PayBillResponse | null>(null)
  const [biometricOk, setBiometricOk] = useState(false)

  useEffect(() => { void isBiometricAvailable().then(setBiometricOk) }, [])

  // Load rate + balance + variations when entering step 2
  useEffect(() => {
    if (step !== 2 || !provider) return
    setLoadingMeta(true)
    const calls: Promise<unknown>[] = [getExchangeRate(), getBalance()]
    if (config.hasVariations) {
      setLoadingVars(true)
      calls.push(getBillVariations(provider.id))
    }
    Promise.all(calls)
      .then(([r, bal, vars]) => {
        setRate(parseFloat((r as { effectiveRate: string }).effectiveRate))
        setBalance((bal as { totalUsdc: string }).totalUsdc)
        if (vars) setVariations(vars as BillVariation[])
      })
      .catch(() => {})
      .finally(() => { setLoadingMeta(false); setLoadingVars(false) })
  }, [step, provider, config.hasVariations])

  // ── Derived ──
  const ngnAmount  = selectedVar
    ? parseFloat(selectedVar.variationAmount) || 0
    : parseFloat(customAmount.replace(/,/g, '')) || 0
  const usdcNeeded = rate > 0 ? ngnAmount / rate : 0
  const balanceNum = parseFloat(balance) || 0

  // ── Step 1 handlers ──

  async function handleVerify() {
    if (!provider)             { setVerifyError('Select a provider first'); return }
    if (!billersCode.trim())   { setVerifyError(`Enter your ${config.billersCodeLabel}`); return }
    setVerifying(true)
    setVerifyError(null)
    setVerified(null)
    try {
      const res = await verifyBillCustomer({ serviceId: provider.id, billersCode: billersCode.trim() })
      setVerified(res.customerName ?? res.name)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Verification failed'
      setVerifyError(msg)
    } finally {
      setVerifying(false)
    }
  }

  function handleStep1Next() {
    if (!provider)           { setStep1Error('Select a provider');           return }
    if (!billersCode.trim()) { setStep1Error(`Enter your ${config.billersCodeLabel}`); return }
    if (config.needsVerify && !verified) { setStep1Error('Verify the account first'); return }
    setStep1Error(null)
    setStep(2)
  }

  // ── Step 2 handler ──

  function handleStep2Next() {
    if (config.hasVariations && !selectedVar) { setStep2Error('Select a plan'); return }
    if (config.hasCustomAmount && (!customAmount || ngnAmount <= 0)) { setStep2Error('Enter an amount'); return }
    if (usdcNeeded > balanceNum) { setStep2Error(`Insufficient balance. You have ${fmtUsdc(balance)}`); return }
    setStep2Error(null)
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
    if (!user || !provider) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const deviceId        = await getOrCreateDeviceId()
      const { privateKey }  = await getOrCreateDeviceKeyPair()
      const deviceSignature = await signDeviceId(deviceId, privateKey)
      const pinHash         = overridePinHash ?? await hashPin(pin, user.id)
      const res = await payBill({
        serviceId:     provider.id,
        billersCode:   billersCode.trim(),
        variationCode: selectedVar?.variationCode,
        amount:        config.hasCustomAmount ? ngnAmount.toFixed(2) : undefined,
        pinHash,
        deviceSignature,
        deviceId,
        timestamp: new Date().toISOString(),
        nonce:     `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      })
      setResult(res)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Payment failed'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──

  if (result) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Payment Successful</Text>
          <Text style={s.successAmount}>{fmtNgn(result.amountNgn)}</Text>
          <Text style={s.successSub}>{config.title} · {provider?.name}</Text>

          <View style={s.successDetails}>
            {[
              { label: 'Status',       value: result.status.charAt(0).toUpperCase() + result.status.slice(1),
                color: result.status === 'completed' ? '#4ade80' : '#facc15' },
              { label: 'USDC Debited', value: fmtUsdc(result.amountUsdc) },
              ...(result.token  ? [{ label: 'Token',     value: result.token  }] : []),
              ...(result.units  ? [{ label: 'Units',     value: result.units  }] : []),
              { label: 'Reference',    value: result.reference },
            ].map(({ label, value, color }) => (
              <View key={label} style={s.detailRow}>
                <Text style={s.detailLabel}>{label}</Text>
                <Text style={[s.detailValue, color ? { color } : undefined]} selectable numberOfLines={2}>
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.doneBtn} onPress={onBack}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

          <TouchableOpacity
            onPress={() => step === 1 ? onBack() : setStep((step - 1) as Step)}
            style={s.back} disabled={submitting}
          >
            <Text style={s.backText}>← {step === 1 ? 'Back' : 'Previous'}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{config.title}</Text>
          <StepBar step={step} />

          {/* ── Step 1: Provider + Biller Code ── */}
          {step === 1 && (
            <>
              <Text style={s.fieldLabel}>Provider</Text>
              {loadingBillers ? (
                <View style={s.center}><ActivityIndicator color="#d4a843" /></View>
              ) : (
              <View style={s.providerGrid}>
                {dynamicProviders.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.providerBtn, provider?.id === p.id && s.providerBtnActive]}
                    onPress={() => { setProvider(p); setBillersCode(''); setVerified(null); setVerifyError(null); setStep1Error(null) }}
                  >
                    <Text style={s.providerIcon}>{p.icon}</Text>
                    <Text style={[s.providerName, provider?.id === p.id && s.providerNameActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              )}

              <Text style={s.fieldLabel}>{config.billersCodeLabel}</Text>
              {config.needsVerify ? (
                <>
                  <View style={s.inputRow}>
                    <TextInput
                      style={[s.input, s.inputFlex]}
                      placeholder={config.billersCodePlaceholder}
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={billersCode}
                      onChangeText={(v) => { setBillersCode(v); setVerified(null); setVerifyError(null); setStep1Error(null) }}
                      keyboardType={config.billersCodeKeyboard}
                      editable={!verifying}
                    />
                    <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={verifying}>
                      {verifying
                        ? <ActivityIndicator color="#000" size="small" />
                        : <Text style={s.verifyBtnText}>Verify</Text>
                      }
                    </TouchableOpacity>
                  </View>
                  {verifyError ? <Text style={s.errorText}>{verifyError}</Text> : null}
                  {verified ? (
                    <View style={s.resolvedCard}>
                      <Text style={s.resolvedIcon}>✓</Text>
                      <Text style={s.resolvedText}>{verified}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <TextInput
                  style={s.input}
                  placeholder={config.billersCodePlaceholder}
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={billersCode}
                  onChangeText={(v) => { setBillersCode(v); setStep1Error(null) }}
                  keyboardType={config.billersCodeKeyboard}
                />
              )}

              {step1Error ? <Text style={s.errorText}>{step1Error}</Text> : null}

              <TouchableOpacity style={s.nextBtn} onPress={handleStep1Next}>
                <Text style={s.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Step 2: Plan / Amount ── */}
          {step === 2 && (
            <>
              {loadingMeta || loadingVars ? (
                <View style={s.center}><ActivityIndicator color="#d4a843" /></View>
              ) : (
                <>
                  <View style={s.balanceBanner}>
                    <Text style={s.balanceBannerLabel}>Available Balance</Text>
                    <Text style={s.balanceBannerValue}>{fmtUsdc(balance)}</Text>
                  </View>

                  {/* Variations (Data / TV) */}
                  {config.hasVariations && (
                    <>
                      <Text style={s.fieldLabel}>Select Plan</Text>
                      {variations.map((v) => (
                        <TouchableOpacity
                          key={v.variationCode}
                          style={[s.planRow, selectedVar?.variationCode === v.variationCode && s.planRowActive]}
                          onPress={() => { setSelectedVar(v); setStep2Error(null) }}
                        >
                          <View style={s.planInfo}>
                            <Text style={s.planName}>{v.name}</Text>
                            <Text style={s.planAmount}>{fmtNgn(v.variationAmount)}</Text>
                          </View>
                          {selectedVar?.variationCode === v.variationCode && (
                            <Text style={s.planCheck}>✓</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Custom amount (Airtime / Electricity) */}
                  {config.hasCustomAmount && (
                    <>
                      <Text style={s.fieldLabel}>Amount (NGN)</Text>
                      <TextInput
                        style={[s.input, s.amountInput]}
                        placeholder="0.00"
                        placeholderTextColor="rgba(255,255,255,0.2)"
                        value={customAmount}
                        onChangeText={(v) => { setCustomAmount(v.replace(/[^0-9.]/g, '')); setStep2Error(null) }}
                        keyboardType="decimal-pad"
                      />
                    </>
                  )}

                  {ngnAmount > 0 && rate > 0 && (
                    <View style={s.feeCard}>
                      <View style={s.feeRow}>
                        <Text style={s.feeLabel}>NGN Amount</Text>
                        <Text style={s.feeValue}>{fmtNgn(ngnAmount)}</Text>
                      </View>
                      <View style={[s.feeRow, s.feeTotalRow]}>
                        <Text style={s.feeTotalLabel}>Est. USDC</Text>
                        <Text style={[s.feeTotalValue, usdcNeeded > balanceNum && { color: '#f87171' }]}>
                          ~{fmtUsdc(usdcNeeded)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {step2Error ? <Text style={s.errorText}>{step2Error}</Text> : null}

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
                <Text style={s.summaryTitle}>Review Payment</Text>
                {[
                  { label: 'Service',   value: config.title },
                  { label: 'Provider',  value: provider?.name ?? '' },
                  { label: config.billersCodeLabel, value: billersCode.trim() },
                  ...(verified ? [{ label: 'Customer', value: verified }] : []),
                  ...(selectedVar ? [{ label: 'Plan', value: selectedVar.name }] : []),
                  { label: 'Amount',    value: fmtNgn(ngnAmount) },
                  { label: 'Est. USDC', value: `~${fmtUsdc(usdcNeeded)}` },
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
                  : <Text style={s.nextBtnText}>Pay {fmtNgn(ngnAmount)}</Text>
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
  safe:              { flex: 1, backgroundColor: '#0a0a0a' },
  kav:               { flex: 1 },
  container:         { flexGrow: 1, padding: 20, paddingBottom: 48 },
  back:              { marginBottom: 20 },
  backText:          { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:             { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  center:            { paddingVertical: 40, alignItems: 'center' },

  fieldLabel:        { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                       textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  providerGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  providerBtn:       {
    width: '47%', backgroundColor: '#141414', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  providerBtnActive: { borderColor: '#d4a843', backgroundColor: 'rgba(212,168,67,0.08)' },
  providerIcon:      { fontSize: 24, marginBottom: 6 },
  providerName:      { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  providerNameActive:{ color: '#d4a843' },

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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
  },
  resolvedIcon:      { color: '#4ade80', fontSize: 16 },
  resolvedText:      { color: '#4ade80', fontWeight: '600', fontSize: 14 },

  errorText:         { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },

  balanceBanner:     {
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  balanceBannerLabel:{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  balanceBannerValue:{ fontSize: 20, fontWeight: '700', color: '#fff' },

  planRow:           {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  planRowActive:     { borderColor: '#d4a843', backgroundColor: 'rgba(212,168,67,0.06)' },
  planInfo:          { flex: 1 },
  planName:          { fontSize: 14, color: '#fff', fontWeight: '500', marginBottom: 2 },
  planAmount:        { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  planCheck:         { color: '#d4a843', fontSize: 16, fontWeight: '700' },

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

  successWrap:       { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
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
