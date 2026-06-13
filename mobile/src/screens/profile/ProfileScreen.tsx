import React from 'react'
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'Tabs'>

export default function ProfileScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Profile</Text>
        <TouchableOpacity style={s.row} onPress={() => navigation.navigate('EditProfile')}>
          <Text style={s.rowLabel}>Edit Profile</Text>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.row} onPress={() => navigation.navigate('KYC')}>
          <Text style={s.rowLabel}>KYC Verification</Text>
          <Text style={s.arrow}>›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, padding: 20 },
  title:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 24 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rowLabel:  { color: '#fff', fontSize: 15 },
  arrow:     { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
})
