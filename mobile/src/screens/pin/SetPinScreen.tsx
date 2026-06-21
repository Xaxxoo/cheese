import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  ActivityIndicator, Alert, TouchableOpacity,
} from 'react-native'
import { useAuthStore } from '../../store/auth.store'
import { setPin as apiSetPin } from '../../api/auth'
import { hashPin } from '../../utils/crypto'
import { storePinHash } from '../../utils/biometrics'
import PinPad from '../../components/PinPad'

type Step = 'enter' | 'confirm'

export default function SetPinScreen() {
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [step,    setStep]    = useState<Step>('enter')
  const [pinVal,  setPinVal]  = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  // ── Handlers ──────────────────────────────────────────────

  function handlePinChange(v: string) {
    setPinVal(v)
    if (v.length === 6) {
      // Brief visual feedback before advancing
      setTimeout(() => setStep('confirm'), 140)
    }
  }

  function handleConfirmChange(v: string) {
    setConfirm(v)
    if (v.length === 6) {
      void submit(pinVal, v)
    }
  }

  async function submit(pinValue: string, confirmValue: string) {
    if (confirmValue !== pinValue) {
      Alert.alert('PIN mismatch', 'The PINs you entered do not match. Please try again.')
      setStep('enter')
      setPinVal('')
      setConfirm('')
      return
    }
    if (!user) return
    setLoading(true)
    try {
      const pinHash = await hashPin(pinValue, user.id)
      await apiSetPin(pinHash)
      await storePinHash(pinHash)
      setUser({ ...user, hasPin: true })
      // RootNavigator re-renders automatically to App
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to set PIN. Please try again.'
      Alert.alert('Error', msg)
      setStep('enter')
      setPinVal('')
      setConfirm('')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  const isConfirm = step === 'confirm'

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>{isConfirm ? 'Confirm your PIN' : 'Set your PIN'}</Text>
          <Text style={s.sub}>
            {isConfirm
              ? 'Enter your PIN again to confirm'
              : 'Choose a 6-digit PIN to secure your transactions'}
          </Text>
          {isConfirm && (
            <TouchableOpacity
              onPress={() => { setStep('enter'); setPinVal(''); setConfirm('') }}
              style={s.backLink}
            >
              <Text style={s.backLinkText}>← Change PIN</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color="#d4a843" size="large" />
        ) : (
          <PinPad
            value={isConfirm ? confirm : pinVal}
            onChange={isConfirm ? handleConfirmChange : handlePinChange}
            disabled={loading}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0a0a0a' },
  container:    { flex: 1, paddingHorizontal: 24, paddingTop: 64, alignItems: 'center' },
  header:       { width: '100%', alignItems: 'center', marginBottom: 52 },
  title:        { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 10, textAlign: 'center' },
  sub:          { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
  backLink:     { marginTop: 18 },
  backLinkText: { fontSize: 13, color: '#d4a843' },
})
