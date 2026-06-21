import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface Props {
  value:     string
  onChange:  (v: string) => void
  maxLength?: number
  disabled?: boolean
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['',  '0', '⌫'],
]

export default function PinPad({ value, onChange, maxLength = 6, disabled = false }: Props) {
  function press(key: string) {
    if (disabled || !key) return
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (value.length < maxLength) {
      onChange(value + key)
    }
  }

  return (
    <View style={s.wrap}>
      {/* Dot indicators */}
      <View style={s.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} style={[s.dot, i < value.length && s.dotFilled]} />
        ))}
      </View>

      {/* Number grid */}
      <View style={s.grid}>
        {ROWS.map((row, ri) => (
          <View key={ri} style={s.row}>
            {row.map((key, ki) => (
              <TouchableOpacity
                key={ki}
                style={[s.key, !key && s.keyGhost]}
                onPress={() => press(key)}
                disabled={!key || disabled}
                activeOpacity={0.55}
              >
                <Text style={[s.keyText, key === '⌫' && s.backText]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:      { alignItems: 'center', width: '100%' },
  dots:      { flexDirection: 'row', gap: 18, marginBottom: 44 },
  dot:       {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)',
  },
  dotFilled: { backgroundColor: '#d4a843', borderColor: '#d4a843' },
  grid:      { width: '100%', paddingHorizontal: 16 },
  row:       { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  key:       {
    width: 80, height: 76, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  keyGhost:  { backgroundColor: 'transparent' },
  keyText:   { fontSize: 26, fontWeight: '400', color: '#fff' },
  backText:  { fontSize: 22 },
})
