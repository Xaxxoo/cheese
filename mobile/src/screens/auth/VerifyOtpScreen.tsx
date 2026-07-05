import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native'
import { ArrowLeft } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'
import { verifyEmailOtp, resendOtp } from '../../api/auth'
import { useAuthStore } from '../../store/auth.store'

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>

export default function VerifyOtpScreen({ route, navigation }: Props) {
  const { email, type } = route.params
  const [otp,       setOtp]      = useState('')
  const [loading,   setLoading]  = useState(false)
  const [resending, setResending] = useState(false)
  const [error,     setError]    = useState<string | null>(null)
  const [resent,    setResent]   = useState(false)

  const setUser = useAuthStore((s) => s.setUser)

  async function handleVerify() {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { user } = await verifyEmailOtp({ email, otp, type })
      setUser(user)
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

  async function handleResend() {
    setResending(true)
    setError(null)
    setResent(false)
    try {
      await resendOtp(email, type)
      setResent(true)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to resend code'
      setError(msg)
    } finally {
      setResending(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} disabled={loading}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.sub}>We sent a 6-digit code to{'\n'}{email}</Text>

        {error  ? <Text style={s.error}>{error}</Text>              : null}
        {resent ? <Text style={s.success}>Code resent successfully</Text> : null}

        <TextInput
          style={s.input}
          placeholder="000000"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={otp}
          onChangeText={(v) => { setOtp(v); setError(null) }}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          editable={!loading}
        />

        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleVerify} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={s.btnText}>Verify</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={handleResend} disabled={resending || loading}>
          {resending
            ? <ActivityIndicator color="#d4a843" size="small" />
            : <Text style={s.linkText}>Didn't get it? <Text style={s.linkAccent}>Resend</Text></Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#0a0a0a' },
  container:   { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  back:        { marginBottom: 32 },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:       { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36, lineHeight: 22 },
  error:       { backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
                 color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  success:     { backgroundColor: 'rgba(80,200,120,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
                 color: '#4ade80', fontSize: 13, textAlign: 'center' },
  input:       {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 20, color: '#fff', fontSize: 28,
    letterSpacing: 12, marginBottom: 16,
  },
  btn:         { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#000', fontWeight: '700', fontSize: 15 },
  link:        { alignItems: 'center', marginTop: 16, minHeight: 32, justifyContent: 'center' },
  linkText:    { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  linkAccent:  { color: '#d4a843' },
})
