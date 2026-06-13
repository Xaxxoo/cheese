import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')

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
        />

        <TouchableOpacity
          style={s.btn}
          onPress={() => navigation.navigate('ResetPassword', { email })}
        >
          <Text style={s.btnText}>Send Reset Code</Text>
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
