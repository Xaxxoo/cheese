import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator,
  TextInput,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { resolvePayLink, payPayLink } from '../../api/wallet'
import { useAuthStore } from '../../store/auth.store'
import { getOrCreateDeviceId, getOrCreateDeviceKeyPair, signDeviceId, hashPin } from '../../utils/crypto'
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics'
import { fmtUsdc, fmtDateTime } from '../../utils/format'
import type { PayLinkData } from '../../types'

type Props = NativeStackScreenProps<AppStackParamList, 'PayLinkPay'>

export default function PayLinkPayScreen({ route, navigation }: Props) {
  const { token } = route.params
  const user = useAuthStore((s) => s.user)

  const [link,         setLink]         = useState<PayLinkData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState<string | null>(null)

  const [pin,          setPin]          = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState<string | null>(null)
  const [biometricOk,  setBiometricOk]  = useState(false)
  const [success,      setSuccess]      = useState<{ amountUsdc: string; paidAt: string } | null>(null)

  useEffect(() => {
    resolvePayLink(token)
      .then(setLink)
      .catch((e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'Could not load pay link'
        setLoadError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { void isBiometricAvailable().then(setBiometricOk) }, [])

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
      const res = await payPayLink(token, { pinHash, deviceId, deviceSignature })
      setSuccess({ amountUsdc: res.amountUsdc, paidAt: res.paidAt })
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

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color="#d4a843" size="large" /></View>
      </SafeAreaView>
    )
  }

  // ── Error resolving link ──
  if (loadError || !link) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Link Not Found</Text>
          <Text style={s.errorSub}>{loadError ?? 'This pay link is invalid or has expired.'}</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Already paid / expired / cancelled ──
  const isPayable = link.status === 'pending'

  // ── Success ──
  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Payment Sent</Text>
          <Text style={s.successAmount}>{fmtUsdc(success.amountUsdc)}</Text>
          <Text style={s.successSub}>To @{link.creator.username} · {fmtDateTime(success.paidAt)}</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">

        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.pageTitle}>Pay Link</Text>

        {/* ── Link summary card ── */}
        <View style={s.card}>
          <Text style={s.cardAmount}>{fmtUsdc(link.amountUsdc)}</Text>
          {link.note ? <Text style={s.cardNote}>{link.note}</Text> : null}

          <View style={s.divider} />

          {[
            { label: 'From',    value: `@${link.creator.username}` },
            { label: 'Expires', value: fmtDateTime(link.expiresAt) },
            { label: 'Status',  value: link.status.charAt(0).toUpperCase() + link.status.slice(1) },
          ].map(({ label, value }) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={[s.rowValue, label === 'Status' && !isPayable && { color: '#f87171' }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Not payable ── */}
        {!isPayable && (
          <View style={s.statusBanner}>
            <Text style={s.statusBannerText}>
              This link is {link.status} and can no longer be paid.
            </Text>
          </View>
        )}

        {/* ── PIN + pay (only when pending) ── */}
        {isPayable && (
          <>
            {biometricOk && (
              <TouchableOpacity style={s.biometricBtn} onPress={handleBiometricSubmit} disabled={submitting}>
                <Text style={s.biometricText}>Use Face ID / Fingerprint</Text>
              </TouchableOpacity>
            )}

            <Text style={s.fieldLabel}>{biometricOk ? '— or enter PIN —' : 'Enter PIN'}</Text>
            <TextInput
              style={s.pinInput}
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
              style={[s.payBtn, submitting && s.btnDisabled]}
              onPress={() => handleSubmit()}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#000" />
                : <Text style={s.payBtnText}>Pay {fmtUsdc(link.amountUsdc)}</Text>
              }
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0a0a0a' },
  container:     { flexGrow: 1, padding: 20, paddingBottom: 48 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  back:          { marginBottom: 16 },
  backText:      { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  pageTitle:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 24 },

  card:          {
    backgroundColor: '#141414', borderRadius: 20, padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardAmount:    { fontSize: 36, fontWeight: '700', color: '#fff', letterSpacing: -1, marginBottom: 6, textAlign: 'center' },
  cardNote:      { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 20 },
  divider:       { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 16 },
  row:           {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel:      { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  rowValue:      { fontSize: 13, color: '#fff', fontWeight: '500' },

  statusBanner:  {
    backgroundColor: 'rgba(248,113,113,0.08)', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', alignItems: 'center',
  },
  statusBannerText: { color: '#f87171', fontSize: 14, fontWeight: '500' },

  fieldLabel:    { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                   textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  pinInput:      {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 24,
    letterSpacing: 12, marginBottom: 16,
  },
  errorText:     { color: '#ff6b6b', fontSize: 13, marginBottom: 12 },

  biometricBtn:  {
    backgroundColor: 'rgba(212,168,67,0.1)', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,168,67,0.25)',
  },
  biometricText: { color: '#d4a843', fontWeight: '600', fontSize: 14 },

  payBtn:        {
    backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
    alignItems: 'center', minHeight: 52, justifyContent: 'center',
  },
  btnDisabled:   { opacity: 0.6 },
  payBtnText:    { color: '#000', fontWeight: '700', fontSize: 15 },

  errorIcon:     { fontSize: 48, marginBottom: 16 },
  errorTitle:    { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  errorSub:      { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 32 },

  successIcon:   { fontSize: 56, marginBottom: 16 },
  successTitle:  { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  successAmount: { fontSize: 36, fontWeight: '700', color: '#4ade80', letterSpacing: -1, marginBottom: 4 },
  successSub:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 32 },

  doneBtn:       {
    backgroundColor: '#d4a843', borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 48, alignItems: 'center',
  },
  doneBtnText:   { color: '#000', fontWeight: '700', fontSize: 16 },
})
