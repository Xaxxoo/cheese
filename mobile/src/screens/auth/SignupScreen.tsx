import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'
import { signup } from '../../api/auth'
import { getOrCreateDeviceId, getOrCreateDeviceKeyPair } from '../../utils/crypto'

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>

export default function SignupScreen({ navigation }: Props) {
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', username: '', password: '', referralCode: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setError(null)
  }

  async function handleSignup() {
    const { fullName, email, phone, username, password } = form
    if (!fullName.trim() || !email.trim() || !phone.trim() || !username.trim() || !password.trim()) {
      setError('Please fill in all required fields')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const deviceId               = await getOrCreateDeviceId()
      const { publicKey: devicePublicKey } = await getOrCreateDeviceKeyPair()
      await signup({
        fullName:  fullName.trim(),
        email:     email.trim().toLowerCase(),
        phone:     phone.trim(),
        username:  username.trim().toLowerCase(),
        password,
        devicePublicKey,
        deviceId,
        ...(form.referralCode.trim() ? { referralCode: form.referralCode.trim() } : {}),
      })
      navigation.navigate('VerifyOtp', {
        email: email.trim().toLowerCase(),
        type:  'email_verify',
      })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Sign up failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fields: { key: keyof typeof form; placeholder: string; keyboard: 'default' | 'email-address' | 'phone-pad'; secure?: boolean; required?: boolean }[] = [
    { key: 'fullName',     placeholder: 'Full name',                keyboard: 'default',       required: true },
    { key: 'email',        placeholder: 'Email',                    keyboard: 'email-address', required: true },
    { key: 'phone',        placeholder: 'Phone number',             keyboard: 'phone-pad',     required: true },
    { key: 'username',     placeholder: 'Username',                 keyboard: 'default',       required: true },
    { key: 'password',     placeholder: 'Password',                 keyboard: 'default',       secure: true, required: true },
    { key: 'referralCode', placeholder: 'Referral code (optional)', keyboard: 'default' },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} disabled={loading}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Create account</Text>
          <Text style={s.sub}>Join CheesePay</Text>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {fields.map(({ key, placeholder, keyboard, secure }) => (
            <TextInput
              key={key}
              style={s.input}
              placeholder={placeholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={form[key]}
              onChangeText={set(key)}
              keyboardType={keyboard}
              autoCapitalize="none"
              secureTextEntry={secure}
              editable={!loading}
            />
          ))}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSignup} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>Create Account</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.link} disabled={loading}>
            <Text style={s.linkText}>
              Already have an account? <Text style={s.linkAccent}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#0a0a0a' },
  kav:         { flex: 1 },
  container:   { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  back:        { marginBottom: 24 },
  backText:    { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:       { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 },
  error:       { backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
                 color: '#ff6b6b', fontSize: 13 },
  input:       {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  btn:         { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#000', fontWeight: '700', fontSize: 15 },
  link:        { alignItems: 'center', marginTop: 16 },
  linkText:    { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  linkAccent:  { color: '#d4a843' },
})
