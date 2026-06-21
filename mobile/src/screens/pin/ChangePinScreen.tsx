import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { useAuthStore } from '../../store/auth.store'
import { changePin } from '../../api/auth'
import { hashPin, getOrCreateDeviceId, getOrCreateDeviceKeyPair, signDeviceId } from '../../utils/crypto'
import { storePinHash } from '../../utils/biometrics'
import PinPad from '../../components/PinPad'

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePin'>
type Step  = 'current' | 'new' | 'confirm'

const TITLES: Record<Step, string> = {
  current: 'Enter current PIN',
  new:     'Enter new PIN',
  confirm: 'Confirm new PIN',
}
const SUBS: Record<Step, string> = {
  current: 'Enter your existing 6-digit PIN',
  new:     'Choose a new 6-digit PIN',
  confirm: 'Enter your new PIN again to confirm',
}

// ── Step indicator ────────────────────────────────────────
function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ['current', 'new', 'confirm']
  const idx = steps.indexOf(step)
  return (
    <View style={sd.row}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <View style={[sd.dot, i === idx && sd.dotActive, i < idx && sd.dotDone]} />
          {i < 2 && <View style={[sd.line, i < idx && sd.lineDone]} />}
        </React.Fragment>
      ))}
    </View>
  )
}

const sd = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  dot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)' },
  dotActive:{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#d4a843' },
  dotDone:  { backgroundColor: '#4ade80' },
  line:     { flex: 1, height: 2, marginHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  lineDone: { backgroundColor: '#4ade80' },
})

// ── Main screen ───────────────────────────────────────────
export default function ChangePinScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user)

  const [step,       setStep]       = useState<Step>('current')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [loading,    setLoading]    = useState(false)

  // ── Navigation back through steps ─────────────────────────
  function goBack() {
    if (step === 'new')     { setNewPin('');     setStep('current'); return }
    if (step === 'confirm') { setConfirmPin(''); setStep('new');     return }
    navigation.goBack()
  }

  // ── Change handlers — each advances to the next step ──────
  function handleCurrentChange(v: string) {
    setCurrentPin(v)
    if (v.length === 6) setTimeout(() => setStep('new'), 140)
  }

  function handleNewChange(v: string) {
    setNewPin(v)
    if (v.length === 6) setTimeout(() => setStep('confirm'), 140)
  }

  function handleConfirmChange(v: string) {
    setConfirmPin(v)
    if (v.length === 6) void submit(currentPin, newPin, v)
  }

  // ── Submit ────────────────────────────────────────────────
  async function submit(curPin: string, nPin: string, confPin: string) {
    if (confPin !== nPin) {
      Alert.alert('PIN mismatch', 'New PINs do not match. Please try again.')
      setNewPin('')
      setConfirmPin('')
      setStep('new')
      return
    }
    if (!user) return
    setLoading(true)
    try {
      const [curHash, newHash, deviceId, keyPair] = await Promise.all([
        hashPin(curPin, user.id),
        hashPin(nPin,   user.id),
        getOrCreateDeviceId(),
        getOrCreateDeviceKeyPair(),
      ])
      const deviceSignature = await signDeviceId(deviceId, keyPair.privateKey)
      await changePin({ currentPinHash: curHash, newPinHash: newHash, deviceId, deviceSignature })
      await storePinHash(newHash)
      Alert.alert('Success', 'Your PIN has been changed successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Failed to change PIN. Please try again.'
      Alert.alert('Error', msg)
      // If current PIN was wrong, restart from current step
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setStep('current')
    } finally {
      setLoading(false)
    }
  }

  // ── Pick the right value/handler for the active step ──────
  const padValue   = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin
  const padHandler = step === 'current' ? handleCurrentChange
    : step === 'new'     ? handleNewChange
    : handleConfirmChange

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={goBack} style={s.back} disabled={loading}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <StepDots step={step} />
          <Text style={s.title}>{TITLES[step]}</Text>
          <Text style={s.sub}>{SUBS[step]}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#d4a843" size="large" />
        ) : (
          <PinPad value={padValue} onChange={padHandler} disabled={loading} />
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  back:      { alignSelf: 'flex-start', marginBottom: 20 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  header:    { width: '100%', alignItems: 'center', marginBottom: 48 },
  title:     { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20 },
})
