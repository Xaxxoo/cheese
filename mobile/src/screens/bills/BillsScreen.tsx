import React from 'react'
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'Bills'>

export default function BillsScreen({ navigation }: Props) {
  const items = [
    { label: 'Airtime',     screen: 'Airtime'     },
    { label: 'Data',        screen: 'Data'        },
    { label: 'TV',          screen: 'Tv'          },
    { label: 'Electricity', screen: 'Electricity' },
  ] as const

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Pay Bills</Text>
        {items.map(({ label, screen }) => (
          <TouchableOpacity
            key={label}
            style={s.row}
            onPress={() => navigation.navigate(screen as keyof AppStackParamList)}
          >
            <Text style={s.rowLabel}>{label}</Text>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, padding: 20 },
  back:      { marginBottom: 24 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  title:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rowLabel:  { color: '#fff', fontSize: 15 },
  arrow:     { color: 'rgba(255,255,255,0.3)', fontSize: 20 },
})
