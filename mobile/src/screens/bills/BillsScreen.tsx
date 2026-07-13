import React from 'react'
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native'
import { ArrowLeft, Zap } from 'lucide-react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<AppStackParamList, 'Bills'>

export default function BillsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={16} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
            <Text style={s.backText}>Back</Text>
          </View>
        </TouchableOpacity>

        <View style={s.center}>
          <View style={s.iconWrap}>
            <Zap size={36} color="#d4a843" strokeWidth={1.5} />
          </View>
          <Text style={s.title}>Coming Soon</Text>
          <Text style={s.subtitle}>
            Bill payments — airtime, data, cable TV, and electricity — are on their way. We'll let you know as soon as they're live.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, padding: 20 },
  back:      { marginBottom: 24 },
  backText:  { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconWrap:  {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(212,168,67,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  title:     { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle:  { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
})
