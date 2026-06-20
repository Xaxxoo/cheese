import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { useAuthStore } from '../../store/auth.store'
import { verifyBvn, verifyNin } from '../../api/wallet'

type Props = NativeStackScreenProps<AppStackParamList, 'KYC'>
type Method = 'bvn' | 'nin'

function StatusCard({ status, tier }: { status?: string; tier?: string }) {
  const isVerified  = status === 'verified'
  const isSubmitted = status === 'submitted'
  const isRejected  = status === 'rejected'

  const icon  = isVerified ? '✅' : isSubmitted ? '⏳' : '❌'
  const label = isVerified ? 'Identity Verified'
    : isSubmitted ? 'Under Review'
    : 'Verification Rejected'
  const desc  = isVerified
    ? `Your identity has been verified. You are on the ${tier ?? 'silver'} tier.`
    : isSubmitted
    ? 'Your KYC submission is being reviewed. This usually takes a few hours.'
    : 'Your verification was rejected. Please try again or contact support.'
  const color = isVerified ? '#4ade80' : isSubmitted ? '#facc15' : '#f87171'

  return (
    <View style={[ss.card, { borderColor: color + '40' }]}>
      <Text style={ss.icon}>{icon}</Text>
      <Text style={[ss.label, { color }]}>{label}</Text>
      <Text style={ss.desc}>{desc}</Text>
    </View>
  )
}

export default function KycScreen({ navigation }: Props) {
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [method,  setMethod]  = useState<Method>('bvn')
  const [value,   setValue]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  const alreadyDone = user?.kycStatus === 'verified' || user?.kycStatus === 'submitted'

  async function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError(`Please enter your ${method.toUpperCase()}`)
      return
    }
    if (method === 'bvn' && trimmed.length !== 11) {
      setError('BVN must be exactly 11 digits')
      return
    }
    if (method === 'nin' && trimmed.length !== 11) {
      setError('NIN must be exactly 11 digits')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = method === 'bvn'
        ? await verifyBvn(trimmed)
        : await verifyNin(trimmed)
      // Merge updated fields into the auth store user
      if (user) {
        setUser({ ...user, kycStatus: result.kycStatus as typeof user.kycStatus, tier: result.tier as typeof user.tier })
      }
      setDone(true)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Verification failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} disabled={loading}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={s.title}>KYC Verification</Text>
          <Text style={s.sub}>Verify your identity to unlock higher limits</Text>

          {/* Tier info */}
          <View style={s.tierRow}>
            {[
              { label: 'Silver', desc: 'Basic',    color: '#94a3b8' },
              { label: 'Gold',   desc: 'BVN/NIN',  color: '#d4a843' },
              { label: 'Black',  desc: 'Advanced',  color: '#fff'    },
            ].map(({ label, desc, color }) => (
              <View key={label} style={[s.tierCard, { borderColor: color + '30' }]}>
                <Text style={[s.tierName, { color }]}>{label}</Text>
                <Text style={s.tierDesc}>{desc}</Text>
              </View>
            ))}
          </View>

          {/* Already verified / submitted */}
          {alreadyDone || done ? (
            <StatusCard
              status={done ? (method === 'bvn' ? 'submitted' : 'submitted') : user?.kycStatus}
              tier={user?.tier}
            />
          ) : (
            <>
              {/* Method selector */}
              <Text style={s.fieldLabel}>Verification Method</Text>
              <View style={s.methodRow}>
                <TouchableOpacity
                  style={[s.methodBtn, method === 'bvn' && s.methodBtnActive]}
                  onPress={() => { setMethod('bvn'); setValue(''); setError(null) }}
                >
                  <Text style={[s.methodText, method === 'bvn' && s.methodTextActive]}>BVN</Text>
                  <Text style={[s.methodSub, method === 'bvn' && s.methodSubActive]}>Bank Verification Number</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.methodBtn, method === 'nin' && s.methodBtnActive]}
                  onPress={() => { setMethod('nin'); setValue(''); setError(null) }}
                >
                  <Text style={[s.methodText, method === 'nin' && s.methodTextActive]}>NIN</Text>
                  <Text style={[s.methodSub, method === 'nin' && s.methodSubActive]}>National ID Number</Text>
                </TouchableOpacity>
              </View>

              {error ? <Text style={s.error}>{error}</Text> : null}

              <Text style={s.fieldLabel}>{method.toUpperCase()} Number</Text>
              <TextInput
                style={s.input}
                placeholder={`Enter your 11-digit ${method.toUpperCase()}`}
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={value}
                onChangeText={(v) => { setValue(v.replace(/\D/g, '')); setError(null) }}
                keyboardType="number-pad"
                maxLength={11}
                editable={!loading}
              />

              <View style={s.privacyCard}>
                <Text style={s.privacyText}>
                  🔒 Your information is encrypted and used only for identity verification.
                  We do not store your {method.toUpperCase()} after verification.
                </Text>
              </View>

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={s.btnText}>Verify Identity</Text>
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
  safe:            { flex: 1, backgroundColor: '#0a0a0a' },
  kav:             { flex: 1 },
  container:       { flexGrow: 1, padding: 20, paddingBottom: 48 },
  back:            { marginBottom: 24 },
  backText:        { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:           { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:             { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 24 },

  tierRow:         { flexDirection: 'row', gap: 8, marginBottom: 28 },
  tierCard:        {
    flex: 1, backgroundColor: '#141414', borderRadius: 12, padding: 12,
    borderWidth: 1, alignItems: 'center',
  },
  tierName:        { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  tierDesc:        { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  fieldLabel:      { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                     textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  methodRow:       { flexDirection: 'row', gap: 10, marginBottom: 20 },
  methodBtn:       {
    flex: 1, backgroundColor: '#141414', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  methodBtnActive: { backgroundColor: 'rgba(212,168,67,0.12)', borderColor: '#d4a843' },
  methodText:      { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  methodTextActive:{ color: '#d4a843' },
  methodSub:       { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  methodSubActive: { color: 'rgba(212,168,67,0.6)' },

  error:           { backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10, padding: 12,
                     marginBottom: 16, color: '#ff6b6b', fontSize: 13 },

  input:           {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 18,
    letterSpacing: 4, marginBottom: 16, textAlign: 'center',
  },

  privacyCard:     {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  privacyText:     { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18 },

  btn:             { backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
                     alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  btnDisabled:     { opacity: 0.6 },
  btnText:         { color: '#000', fontWeight: '700', fontSize: 15 },
})

const ss = StyleSheet.create({
  card:  {
    backgroundColor: '#141414', borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: 1, marginTop: 8,
  },
  icon:  { fontSize: 44, marginBottom: 16 },
  label: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  desc:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
})
