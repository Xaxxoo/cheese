import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'
import { resetPassword } from '../../api/auth'

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params

  const [otp,      setOtp]      = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleReset() {
    if (otp.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit code')
      return
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await resetPassword({ email, otp, newPassword: password })
      Alert.alert('Success', 'Password reset successfully', [
        { text: 'Log in', onPress: () => navigation.navigate('Login') },
      ])
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to reset password'
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
        <Text style={s.title}>Reset password</Text>
        <Text style={s.sub}>Enter the code sent to {email}</Text>

        <TextInput
          style={s.input}
          placeholder="6-digit code"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          editable={!loading}
        />
        <TextInput
          style={s.input}
          placeholder="New password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[s.btn, loading && s.btnDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={s.btnText}>Reset Password</Text>
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
