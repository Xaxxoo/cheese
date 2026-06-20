import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'
import { forgotPassword } from '../../api/auth'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    const trimmed = email.trim()
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email address')
      return
    }
    setLoading(true)
    try {
      await forgotPassword(trimmed)
      navigation.navigate('ResetPassword', { email: trimmed })
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to send reset code'
      Alert.alert('Error', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Forgot password</Text>
        <Text style={s.sub}>Enter your email and we'll send you a reset code</Text>

        <TextInput
          style={s.input}
          placeholder="Email address"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={s.btnText}>Send Reset Code</Text>
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
  sub:         { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36 },
  input:       {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  btn:         { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#000', fontWeight: '700', fontSize: 15 },
})
