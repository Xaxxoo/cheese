import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { useAuthStore } from '../../store/auth.store'
import { updateProfile } from '../../api/auth'

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>

export default function EditProfileScreen({ navigation }: Props) {
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    phone:    user?.phone    ?? '',
    username: user?.username  ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setError(null)
    setSaved(false)
  }

  async function handleSave() {
    if (!form.fullName.trim() || !form.username.trim()) {
      setError('Full name and username are required')
      return
    }
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateProfile({
        fullName: form.fullName.trim(),
        phone:    form.phone.trim() || undefined,
        username: form.username.trim().toLowerCase(),
      })
      setUser(updated)
      setSaved(true)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Failed to update profile'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fields: { key: keyof typeof form; label: string; placeholder: string; keyboard: 'default' | 'phone-pad'; autoCapitalize: 'none' | 'words' }[] = [
    { key: 'fullName', label: 'Full Name',    placeholder: 'Your full name',   keyboard: 'default',    autoCapitalize: 'words' },
    { key: 'username', label: 'Username',     placeholder: 'username',          keyboard: 'default',    autoCapitalize: 'none'  },
    { key: 'phone',    label: 'Phone Number', placeholder: '+234 800 000 0000', keyboard: 'phone-pad',  autoCapitalize: 'none'  },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} disabled={loading}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={s.title}>Edit Profile</Text>
          <Text style={s.sub}>Update your account details</Text>

          {error  ? <Text style={s.error}>{error}</Text>                   : null}
          {saved  ? <Text style={s.success}>Profile updated successfully</Text> : null}

          {/* Read-only email */}
          <Text style={s.fieldLabel}>Email</Text>
          <View style={s.readOnly}>
            <Text style={s.readOnlyText}>{user?.email}</Text>
            <Text style={s.readOnlyHint}>Cannot be changed</Text>
          </View>

          {fields.map(({ key, label, placeholder, keyboard, autoCapitalize }) => (
            <View key={key}>
              <Text style={s.fieldLabel}>{label}</Text>
              <TextInput
                style={s.input}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={form[key]}
                onChangeText={set(key)}
                keyboardType={keyboard}
                autoCapitalize={autoCapitalize}
                editable={!loading}
              />
            </View>
          ))}

          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSave} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#0a0a0a' },
  kav:          { flex: 1 },
  container:    { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  back:         { marginBottom: 24 },
  backText:     { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:        { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  sub:          { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 28 },

  error:        { backgroundColor: 'rgba(255,80,80,0.1)', borderRadius: 10, padding: 12,
                  marginBottom: 16, color: '#ff6b6b', fontSize: 13 },
  success:      { backgroundColor: 'rgba(80,200,120,0.1)', borderRadius: 10, padding: 12,
                  marginBottom: 16, color: '#4ade80', fontSize: 13 },

  fieldLabel:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },

  readOnly:     {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 16, marginBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  readOnlyText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  readOnlyHint: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },

  input:        {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 20,
  },

  btn:          { backgroundColor: '#d4a843', borderRadius: 14, padding: 16,
                  alignItems: 'center', marginTop: 8, minHeight: 52, justifyContent: 'center' },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#000', fontWeight: '700', fontSize: 15 },
})
