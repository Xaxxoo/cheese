import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyOtp'>

export default function VerifyOtpScreen({ route, navigation }: Props) {
  const { email } = route.params
  const [otp, setOtp] = useState('')

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Check your email</Text>
        <Text style={s.sub}>We sent a 6-digit code to{'\n'}{email}</Text>

        <TextInput
          style={s.input}
          placeholder="000000"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />

        <TouchableOpacity style={s.btn}>
          <Text style={s.btnText}>Verify</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.link}>
          <Text style={s.linkText}>Didn't get it? <Text style={s.linkAccent}>Resend</Text></Text>
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
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 36, lineHeight: 22 },
  input:     {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 20, color: '#fff', fontSize: 28,
    letterSpacing: 12, marginBottom: 16,
  },
  btn:       { backgroundColor: '#d4a843', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText:   { color: '#000', fontWeight: '700', fontSize: 15 },
  link:      { alignItems: 'center', marginTop: 16 },
  linkText:  { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  linkAccent:{ color: '#d4a843' },
})
