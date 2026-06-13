import React from 'react'
import { View, Text, StyleSheet, SafeAreaView } from 'react-native'

export default function HistoryScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Transaction History</Text>
        <Text style={s.sub}>Your transactions will appear here</Text>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, padding: 20 },
  title:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.35)' },
})
