import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>

export default function SignupScreen({ navigation }: Props) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', username: '', password: '', referralCode: '' })
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Create account</Text>
          <Text style={s.sub}>Join CheesePay</Text>

          {[
            { key: 'fullName',    placeholder: 'Full name',                  keyboard: 'default' as const },
            { key: 'email',       placeholder: 'Email',                      keyboard: 'email-address' as const },
            { key: 'phone',       placeholder: 'Phone number',               keyboard: 'phone-pad' as const },
            { key: 'username',    placeholder: 'Username',                   keyboard: 'default' as const },
            { key: 'password',    placeholder: 'Password',                   keyboard: 'default' as const },
            { key: 'referralCode',placeholder: 'Referral code (optional)',   keyboard: 'default' as const },
          ].map(({ key, placeholder, keyboard }) => (
            <TextInput
              key={key}
              style={s.input}
              placeholder={placeholder}
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={form[key as keyof typeof form]}
              onChangeText={set(key as keyof typeof form)}
              keyboardType={keyboard}
              autoCapitalize="none"
              secureTextEntry={key === 'password'}
            />
          ))}

          <TouchableOpacity style={s.btn}>
            <Text style={s.btnText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.link}>
            <Text style={s.linkText}>Already have an account? <Text style={s.linkAccent}>Sign in</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  kav:       { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  back:      { marginBottom: 24 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:     { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 },
  input:     {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  btn:       { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText:   { color: '#000', fontWeight: '700', fontSize: 15 },
  link:      { alignItems: 'center', marginTop: 16 },
  linkText:  { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  linkAccent:{ color: '#d4a843' },
})
