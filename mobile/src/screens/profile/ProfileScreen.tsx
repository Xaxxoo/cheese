import React, { useState } from 'react'
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { AppStackParamList } from '../../navigation/types'
import { useAuthStore } from '../../store/auth.store'
import { logout } from '../../api/auth'

type Props = NativeStackScreenProps<AppStackParamList, 'Tabs'>

// ── Helpers ───────────────────────────────────────────────

function initials(name: string | null, username: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return username.slice(0, 2).toUpperCase()
}

function tierLabel(tier?: string): string {
  switch (tier) {
    case 'silver': return 'Silver'
    case 'gold':   return 'Gold'
    case 'black':  return 'Black'
    default:       return 'Silver'
  }
}

function tierColor(tier?: string): string {
  switch (tier) {
    case 'gold':  return '#d4a843'
    case 'black': return '#fff'
    default:      return '#94a3b8'
  }
}

function tierBg(tier?: string): string {
  switch (tier) {
    case 'gold':  return 'rgba(212,168,67,0.15)'
    case 'black': return 'rgba(255,255,255,0.1)'
    default:      return 'rgba(148,163,184,0.15)'
  }
}

function kycLabel(status?: string): string {
  switch (status) {
    case 'verified':  return 'Verified'
    case 'submitted': return 'Under Review'
    case 'rejected':  return 'Rejected'
    default:          return 'Not Verified'
  }
}

function kycColor(status?: string): string {
  switch (status) {
    case 'verified':  return '#4ade80'
    case 'submitted': return '#facc15'
    case 'rejected':  return '#f87171'
    default:          return 'rgba(255,255,255,0.3)'
  }
}

// ── Component ─────────────────────────────────────────────

export default function ProfileScreen({ navigation }: Props) {
  const user  = useAuthStore((s) => s.user)
  const clear = useAuthStore((s) => s.clear)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true)
          try {
            await logout()
          } finally {
            clear()
          }
        },
      },
    ])
  }

  const menuItems = [
    { label: 'Edit Profile',      icon: '✏️',  onPress: () => navigation.navigate('EditProfile')   },
    { label: 'Change PIN',        icon: '🔐',  onPress: () => navigation.navigate('ChangePin')     },
    { label: 'Referrals',         icon: '🎁',  onPress: () => navigation.navigate('Referral')      },
    { label: 'KYC Verification',  icon: '🪪',  onPress: () => navigation.navigate('KYC')           },
    { label: 'Notifications',     icon: '🔔',  onPress: () => navigation.navigate('Notifications') },
  ]

  if (!user) return null

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.heading}>Profile</Text>

        {/* Avatar + info */}
        <View style={s.avatarCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(user.fullName, user.username)}</Text>
          </View>
          <Text style={s.name}>{user.fullName ?? `@${user.username}`}</Text>
          <Text style={s.username}>@{user.username}</Text>
          <Text style={s.email}>{user.email}</Text>

          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: tierBg(user.tier) }]}>
              <Text style={[s.badgeText, { color: tierColor(user.tier) }]}>
                {tierLabel(user.tier)}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: kycColor(user.kycStatus) + '1a' }]}>
              <View style={[s.kycDot, { backgroundColor: kycColor(user.kycStatus) }]} />
              <Text style={[s.badgeText, { color: kycColor(user.kycStatus) }]}>
                {kycLabel(user.kycStatus)}
              </Text>
            </View>
          </View>
        </View>

        {/* Wallet info */}
        {user.stellarPublicKey ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Stellar Wallet</Text>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Address</Text>
              <Text style={s.infoValue} numberOfLines={1} ellipsizeMode="middle">
                {user.stellarPublicKey}
              </Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Status</Text>
              <Text style={[s.infoValue, {
                color: user.stellarWalletStatus === 'active' ? '#4ade80'
                  : user.stellarWalletStatus === 'failed' ? '#f87171' : '#facc15',
              }]}>
                {user.stellarWalletStatus ?? 'pending'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Menu */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Account</Text>
          {menuItems.map(({ label, icon, onPress }) => (
            <TouchableOpacity key={label} style={s.menuRow} onPress={onPress}>
              <Text style={s.menuIcon}>{icon}</Text>
              <Text style={s.menuLabel}>{label}</Text>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut
            ? <ActivityIndicator color="#f87171" />
            : <Text style={s.logoutText}>Log out</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#0a0a0a' },
  container:   { padding: 20, paddingBottom: 48 },
  heading:     { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },

  avatarCard:  {
    backgroundColor: '#141414', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar:      {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#d4a843', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText:  { fontSize: 26, fontWeight: '700', color: '#000' },
  name:        { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 2 },
  username:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  email:       { fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 14 },

  badgeRow:    { flexDirection: 'row', gap: 8 },
  badge:       {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  kycDot:      { width: 6, height: 6, borderRadius: 3 },
  badgeText:   { fontSize: 12, fontWeight: '600' },

  section:     {
    backgroundColor: '#141414', borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  sectionLabel:{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.3)',
                 letterSpacing: 0.8, textTransform: 'uppercase',
                 paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

  infoRow:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  infoValue:   { fontSize: 13, color: '#fff', fontWeight: '500', flex: 2, textAlign: 'right' },

  menuRow:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  menuIcon:    { fontSize: 18, marginRight: 12 },
  menuLabel:   { flex: 1, fontSize: 15, color: '#fff' },
  arrow:       { fontSize: 20, color: 'rgba(255,255,255,0.25)' },

  logoutBtn:   {
    marginTop: 8, padding: 16, borderRadius: 14,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)',
    alignItems: 'center', minHeight: 52, justifyContent: 'center',
  },
  logoutText:  { color: '#f87171', fontWeight: '700', fontSize: 15 },
})
