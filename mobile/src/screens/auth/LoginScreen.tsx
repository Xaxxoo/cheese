import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export default function LoginScreen({ navigation }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <View style={s.container}>
          <Text style={s.logo}>🧀</Text>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.sub}>Sign in to CheesePay</Text>

          <TextInput
            style={s.input}
            placeholder="Email or username"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={s.btn}>
            <Text style={s.btnText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={s.link}>
            <Text style={s.linkText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={s.link}>
            <Text style={s.linkText}>Don't have an account? <Text style={s.linkAccent}>Sign up</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  kav:       { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo:      { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  title:     { fontSize: 26, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 6 },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 36 },
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
