import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params
  const [otp,      setOtp]      = useState('')
  const [password, setPassword] = useState('')

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
        />
        <TextInput
          style={s.input}
          placeholder="New password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn}>
          <Text style={s.btnText}>Reset Password</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  back:      { marginBottom: 32 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:     { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 8 },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36 },
  input:     {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 12,
  },
  btn:       { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText:   { color: '#000', fontWeight: '700', fontSize: 15 },
})
