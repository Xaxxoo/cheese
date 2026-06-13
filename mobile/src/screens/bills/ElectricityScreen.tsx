import React from 'react'
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'Electricity'>

export default function ElectricityScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Electricity</Text>
        <Text style={s.sub}>Coming soon</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, padding: 20 },
  back:      { marginBottom: 24 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
})
